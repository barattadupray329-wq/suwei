import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $OpenApi from '@alicloud/openapi-client'
import { and, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { customerOtpChallenges, customerPhoneSessions, rentalItems, rentals } from '@/lib/db/schema'

const COOKIE = 'customer_phone_session'
const ACTIVE_STATUSES = ['在租', '即将到期', '逾期']
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const normalizeCustomerPhone = (value: string) => value.replace(/\D/g, '')

function requirePhone(value: string) {
  const phone = normalizeCustomerPhone(value)
  if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确的中国大陆手机号')
  return phone
}

async function sendSms(phone: string, code: string) {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) throw new Error('短信服务尚未配置，请联系管理员')
  const client = new Dysmsapi20170525(new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' }))
  const response = await client.sendSms(new $Dysmsapi20170525.SendSmsRequest({ phoneNumbers: phone, signName, templateCode, templateParam: JSON.stringify({ code }) }))
  if (response.body?.code !== 'OK') throw new Error('验证码发送失败，请稍后重试')
}

export async function requestCustomerOtp(rawPhone: string, requestIp: string) {
  const phone = requirePhone(rawPhone)
  const ipHash = digest(`${requestIp}.${process.env.BETTER_AUTH_SECRET}`)
  const oneMinuteAgo = new Date(Date.now() - 60000)
  const oneHourAgo = new Date(Date.now() - 60 * 60000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000)
  const [[recentIp], [recentPhone], [hourlyPhone], [dailyIp]] = await Promise.all([
    db.select({ id: customerOtpChallenges.id }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.requestIpHash, ipHash), gt(customerOtpChallenges.createdAt, oneMinuteAgo))).limit(1),
    db.select({ id: customerOtpChallenges.id }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), gt(customerOtpChallenges.createdAt, oneMinuteAgo))).limit(1),
    db.select({ value: count() }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), gt(customerOtpChallenges.createdAt, oneHourAgo))),
    db.select({ value: count() }).from(customerOtpChallenges).where(and(eq(customerOtpChallenges.requestIpHash, ipHash), gt(customerOtpChallenges.createdAt, oneDayAgo))),
  ])
  if (recentIp || recentPhone) throw new Error('请求过于频繁，请一分钟后再试')
  if (Number(hourlyPhone?.value ?? 0) >= 5 || Number(dailyIp?.value ?? 0) >= 30) throw new Error('验证码请求次数已达上限，请稍后再试')

  const [eligible] = await db.select({ id: rentals.id }).from(rentals).where(and(eq(rentals.customerPhone, phone), inArray(rentals.status, ACTIVE_STATUSES))).limit(1)
  if (!eligible) return

  const code = String(randomInt(100000, 1000000))
  await sendSms(phone, code)
  await db.insert(customerOtpChallenges).values({ phone, codeHash: digest(`${phone}.${code}.${process.env.BETTER_AUTH_SECRET}`), expiresAt: new Date(Date.now() + 5 * 60000), requestIpHash: ipHash })
}

export async function verifyCustomerOtp(rawPhone: string, code: string) {
  const phone = requirePhone(rawPhone)
  if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位验证码')
  const [challenge] = await db.select().from(customerOtpChallenges).where(and(eq(customerOtpChallenges.phone, phone), isNull(customerOtpChallenges.consumedAt), gt(customerOtpChallenges.expiresAt, new Date()))).orderBy(desc(customerOtpChallenges.createdAt)).limit(1)
  if (!challenge || challenge.attempts >= 5) throw new Error('验证码错误或已过期')
  const expected = Buffer.from(challenge.codeHash)
  const actual = Buffer.from(digest(`${phone}.${code}.${process.env.BETTER_AUTH_SECRET}`))
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await db.update(customerOtpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(customerOtpChallenges.id, challenge.id))
    throw new Error('验证码错误或已过期')
  }
  await db.update(customerOtpChallenges).set({ consumedAt: new Date() }).where(eq(customerOtpChallenges.id, challenge.id))
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
  await db.insert(customerPhoneSessions).values({ phone, tokenHash: digest(token), expiresAt })
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt, priority: 'high' })
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
  const contracts = await db.select({ id: rentals.id, contractNo: rentals.contractNo, customerName: rentals.customerName, deviceName: rentals.deviceName, deviceType: rentals.deviceType, quantity: rentals.quantity, startDate: rentals.startDate, endDate: rentals.endDate, monthlyRent: rentals.monthlyRent, deposit: rentals.deposit, status: rentals.status }).from(rentals).where(and(eq(rentals.customerPhone, phone), inArray(rentals.status, ACTIVE_STATUSES))).orderBy(desc(rentals.id))
  const ids = contracts.map((contract) => contract.id)
  const items = ids.length ? await db.select({ id: rentalItems.id, rentalId: rentalItems.rentalId, deviceName: rentalItems.deviceName, deviceType: rentalItems.deviceType, deviceCode: rentalItems.deviceCode, deviceConfig: rentalItems.deviceConfig, quantity: rentalItems.quantity, startDate: rentalItems.startDate, endDate: rentalItems.endDate }).from(rentalItems).where(inArray(rentalItems.rentalId, ids)) : []
  return { phone, contracts, items }
}
