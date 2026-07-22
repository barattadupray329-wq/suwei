import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import { and, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { accountProfiles, customerOtpChallenges, customerPhoneSessions, customerPortals, rentalItems, rentals, session, user } from '@/lib/db/schema'

const COOKIE = 'customer_phone_session'
const ACTIVE_STATUSES = ['在租', '即将到期', '逾期']
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
function otpSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new CustomerOtpError('验证服务暂不可用，请联系客服', 503)
  return secret
}
export const normalizeCustomerPhone = (value: string) => value.replace(/\D/g, '')

function requirePhone(value: string) {
  const phone = normalizeCustomerPhone(value)
  if (!/^1\d{10}$/.test(phone)) throw new CustomerOtpError('请输入正确的中国大陆手机号', 400)
  return phone
}

const SMS_RESEND_SECONDS = 60
const SMS_EXPIRES_SECONDS = 5 * 60

export class CustomerOtpError extends Error {
  constructor(message: string, readonly status = 400, readonly retryAfter?: number) {
    super(message)
    this.name = 'CustomerOtpError'
  }
}

export const maskCustomerPhone = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')

async function ensureEligibleCustomerProfiles(phone: string) {
  const contracts = await db.select({ ownerId: rentals.userId, customerName: rentals.customerName }).from(rentals).where(and(eq(rentals.customerPhone, phone), inArray(rentals.status, ACTIVE_STATUSES)))
  if (!contracts.length) return []
  const existing = await db.select().from(customerPortals).where(eq(customerPortals.phone, phone))
  const existingOwners = new Set(existing.map((portal) => portal.userId))
  const customersByOwner = new Map(contracts.map((contract) => [contract.ownerId, contract.customerName]))
  for (const [ownerId, customerName] of customersByOwner) {
    if (existingOwners.has(ownerId)) continue
    await db.insert(customerPortals).values({ userId: ownerId, phone, customerName, accessTokenHash: digest(randomBytes(32).toString('hex')), passwordHash: digest(randomBytes(32).toString('hex')), status: 'active' })
  }
  return db.select().from(customerPortals).where(and(eq(customerPortals.phone, phone), eq(customerPortals.status, 'active')))
}

export function smsFailureMessage(code?: string) {
  if (code === 'isv.BUSINESS_LIMIT_CONTROL') return '验证码请求过于频繁，请稍后再试'
  if (code === 'isv.MOBILE_NUMBER_ILLEGAL') return '请输入正确的中国大陆手机号'
  if (code === 'isv.SMS_TEMPLATE_ILLEGAL' || code === 'isv.SMS_SIGNATURE_ILLEGAL') return '短信服务暂不可用，请联系客服'
  return '验证码发送失败，请稍后重试'
}

async function sendSms(phone: string, code: string) {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) throw new CustomerOtpError('短信服务暂不可用，请联系客服', 503)
  try {
    const client = new Dysmsapi20170525(new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com', connectTimeout: 5000, readTimeout: 10000 }))
    const response = await client.sendSms(new $Dysmsapi20170525.SendSmsRequest({ phoneNumbers: phone, signName, templateCode, templateParam: JSON.stringify({ code }) }))
    if (response.body?.code !== 'OK') {
      console.error('[sms] Aliyun rejected OTP request', { code: response.body?.code, requestId: response.body?.requestId, phone: maskCustomerPhone(phone) })
      throw new CustomerOtpError(smsFailureMessage(response.body?.code), response.body?.code === 'isv.BUSINESS_LIMIT_CONTROL' ? 429 : 502, SMS_RESEND_SECONDS)
    }
    console.info('[sms] OTP accepted by Aliyun', { requestId: response.body?.requestId, phone: maskCustomerPhone(phone) })
  } catch (error) {
    if (error instanceof CustomerOtpError) throw error
    console.error('[sms] Aliyun OTP request failed', { name: error instanceof Error ? error.name : 'UnknownError', phone: maskCustomerPhone(phone) })
    throw new CustomerOtpError('验证码发送失败，请稍后重试', 502, SMS_RESEND_SECONDS)
  }
}

export async function getPhoneIdentities(rawPhone: string) {
  const phone = requirePhone(rawPhone)
  const [staff, customers] = await Promise.all([
    db.select({ id: user.id }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(and(eq(user.phoneNumber, phone), eq(accountProfiles.active, true))).limit(1),
    ensureEligibleCustomerProfiles(phone),
  ])
  return { phone, workspace: staff.length > 0, customer: customers.length > 0 }
}

export async function sendUnifiedPhoneOtp(rawPhone: string, code: string, requestIp: string) {
  const phone = requirePhone(rawPhone)
  const ipHash = digest(`${requestIp}.${otpSecret()}`)
  const now = new Date()
  await sendSms(phone, code)
  await db.update(customerOtpChallenges).set({ consumedAt: now }).where(and(eq(customerOtpChallenges.phone, phone), isNull(customerOtpChallenges.consumedAt)))
  await db.insert(customerOtpChallenges).values({ phone, codeHash: digest(`${phone}.${code}.${otpSecret()}`), expiresAt: new Date(now.getTime() + SMS_EXPIRES_SECONDS * 1000), requestIpHash: ipHash })
}

export async function requestCustomerOtp(rawPhone: string, requestIp: string) {
  const phone = requirePhone(rawPhone)
  const ipHash = digest(`${requestIp}.${otpSecret()}`)
  const oneMinuteAgo = new Date(Date.now() - 60000)
  const oneHourAgo = new Date(Date.now() - 60 * 60000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000)
  const [[recentIp], [recentPhone], [hourlyPhone], [dailyIp]] = await Promise.all([
    db.select({ id: customerOtpChallenges.id }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.requestIpHash, ipHash), gt(customerOtpChallenges.createdAt, oneMinuteAgo))).limit(1),
    db.select({ id: customerOtpChallenges.id }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), gt(customerOtpChallenges.createdAt, oneMinuteAgo))).limit(1),
    db.select({ value: count() }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), gt(customerOtpChallenges.createdAt, oneHourAgo))),
    db.select({ value: count() }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.requestIpHash, ipHash), gt(customerOtpChallenges.createdAt, oneDayAgo))),
  ])
  if (recentIp || recentPhone) throw new CustomerOtpError('请求过于频繁，请一分钟后再试', 429, SMS_RESEND_SECONDS)
  if (Number(hourlyPhone?.value ?? 0) >= 5 || Number(dailyIp?.value ?? 0) >= 30) throw new CustomerOtpError('验证码请求次数已达上限，请稍后再试', 429, 60 * 60)

  const identities = await getPhoneIdentities(phone)
  if (!identities.workspace && !identities.customer) {
    const now = new Date()
    await db.insert(customerOtpChallenges).values({ phone, codeHash: digest(randomBytes(32).toString('hex')), expiresAt: new Date(now.getTime() + SMS_EXPIRES_SECONDS * 1000), consumedAt: now, requestIpHash: ipHash })
    return { sent: false, retryAfter: SMS_RESEND_SECONDS, expiresIn: SMS_EXPIRES_SECONDS }
  }

  const code = String(randomInt(100000, 1000000))
  await sendSms(phone, code)
  const now = new Date()
  await db.update(customerOtpChallenges).set({ consumedAt: now }).where(and(eq(customerOtpChallenges.phone, phone), isNull(customerOtpChallenges.consumedAt)))
  await db.insert(customerOtpChallenges).values({ phone, codeHash: digest(`${phone}.${code}.${otpSecret()}`), expiresAt: new Date(now.getTime() + SMS_EXPIRES_SECONDS * 1000), requestIpHash: ipHash })
  return { sent: true, retryAfter: SMS_RESEND_SECONDS, expiresIn: SMS_EXPIRES_SECONDS }
}

export async function verifyCustomerOtp(rawPhone: string, code: string) {
  const phone = requirePhone(rawPhone)
  if (!/^\d{6}$/.test(code)) throw new CustomerOtpError('请输入 6 位验证码', 400)
  const [challenge] = await db.select().from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), isNull(customerOtpChallenges.consumedAt), gt(customerOtpChallenges.expiresAt, new Date()))).orderBy(desc(customerOtpChallenges.createdAt)).limit(1)
  if (!challenge) throw new CustomerOtpError('验证码已过期，请重新获取', 400)
  if (challenge.attempts >= 5) throw new CustomerOtpError('尝试次数过多，请重新获取验证码', 429, SMS_RESEND_SECONDS)
  const expected = Buffer.from(challenge.codeHash, 'hex')
  const actual = Buffer.from(digest(`${phone}.${code}.${otpSecret()}`), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const attempts = challenge.attempts + 1
    await db.update(customerOtpChallenges).set({ attempts, consumedAt: attempts >= 5 ? new Date() : null }).where(eq(customerOtpChallenges.id, challenge.id))
    throw new CustomerOtpError(attempts >= 5 ? '尝试次数过多，请重新获取验证码' : '验证码不正确，请重新输入', attempts >= 5 ? 429 : 400, attempts >= 5 ? SMS_RESEND_SECONDS : undefined)
  }
  const now = new Date()
  await db.update(customerOtpChallenges).set({ consumedAt: now }).where(eq(customerOtpChallenges.id, challenge.id))
  const identities = await getPhoneIdentities(phone)
  if (!identities.workspace && !identities.customer) throw new CustomerOtpError('当前没有可使用的账号或在租信息', 403)
  const cookieStore = await cookies()
  if (identities.customer) {
    await db.update(customerPortals).set({ lastLoginAt: now, failedAttempts: 0, updatedAt: now }).where(and(eq(customerPortals.phone, phone), eq(customerPortals.status, 'active')))
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    await db.delete(customerPhoneSessions).where(eq(customerPhoneSessions.phone, phone))
    await db.insert(customerPhoneSessions).values({ phone, tokenHash: digest(token), expiresAt })
    cookieStore.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt, priority: 'high' })
  }
  if (identities.workspace) {
    const [workspaceUser] = await db.select({ id: user.id }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(and(eq(user.phoneNumber, phone), eq(accountProfiles.active, true))).limit(1)
    if (workspaceUser) {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      await db.insert(session).values({ id: randomUUID(), token, userId: workspaceUser.id, expiresAt, createdAt: now, updatedAt: now })
      const signature = createHmac('sha256', otpSecret()).update(token).digest('base64')
      const cookieName = process.env.NODE_ENV === 'production' ? '__Secure-better-auth.session_token' : 'better-auth.session_token'
      cookieStore.set(cookieName, `${token}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'none', path: '/', expires: expiresAt, priority: 'high' })
    }
  }
  return identities
}

export async function logoutCustomerPhone() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (token) await db.delete(customerPhoneSessions).where(eq(customerPhoneSessions.tokenHash, digest(token)))
  cookieStore.delete(COOKIE)
}

async function sessionPhone() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const [session] = await db.select().from(customerPhoneSessions).where(and(eq(customerPhoneSessions.tokenHash, digest(token)), gt(customerPhoneSessions.expiresAt, new Date())))
  return session?.phone ?? null
}

export async function getCustomerActiveRentals() {
  const phone = await sessionPhone()
  if (!phone) return null
  const customerAccounts = await db.select({ ownerId: customerPortals.userId, name: customerPortals.customerName }).from(customerPortals).where(and(eq(customerPortals.phone, phone), eq(customerPortals.status, 'active')))
  if (!customerAccounts.length) return null
  const ownerIds = [...new Set(customerAccounts.map((account) => account.ownerId))]
  const contracts = await db.select({ id: rentals.id, userId: rentals.userId, contractNo: rentals.contractNo, customerName: rentals.customerName, deviceName: rentals.deviceName, deviceType: rentals.deviceType, quantity: rentals.quantity, startDate: rentals.startDate, endDate: rentals.endDate, monthlyRent: rentals.monthlyRent, deposit: rentals.deposit, status: rentals.status }).from(rentals).where(and(inArray(rentals.userId, ownerIds), eq(rentals.customerPhone, phone), inArray(rentals.status, ACTIVE_STATUSES))).orderBy(desc(rentals.id))
  const ids = contracts.map((contract) => contract.id)
  const items = ids.length ? await db.select({ id: rentalItems.id, rentalId: rentalItems.rentalId, deviceName: rentalItems.deviceName, deviceType: rentalItems.deviceType, deviceCode: rentalItems.deviceCode, deviceConfig: rentalItems.deviceConfig, quantity: rentalItems.quantity, startDate: rentalItems.startDate, endDate: rentalItems.endDate }).from(rentalItems).where(and(inArray(rentalItems.userId, ownerIds), inArray(rentalItems.rentalId, ids))) : []
  return { phone, customerName: customerAccounts[0].name, contracts, items }
}
