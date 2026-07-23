import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { account, customerPhoneSessions, customerPortals, passwordChangeChallenges, session, user } from '@/lib/db/schema'
import { sendSms } from '@/lib/customer-phone-auth'
import { hashPortalPassword, sessionPortal } from '@/lib/customer-portal'
import { sessionPhone } from '@/lib/customer-phone-auth'

const RESEND_SECONDS = 60
const EXPIRES_SECONDS = 300
const secret = process.env.BETTER_AUTH_SECRET ?? 'suwei-local-preview-secret-do-not-use-in-production'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const hashBackendPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 67_108_864 })
  return `${salt}:${key.toString('hex')}`
}

export class PasswordChangeError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message) }
}

type Subject = { type: 'user' | 'customer'; id: string; phone: string }

async function backendSessionUserId() {
  const store = await cookies()
  const signed = store.get('better-auth.session_token')?.value ?? store.get('__Secure-better-auth.session_token')?.value
  if (!signed) return null
  const separator = signed.lastIndexOf('.')
  if (separator < 1) return null
  const token = signed.slice(0, separator)
  const signature = signed.slice(separator + 1)
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const bytes = Uint8Array.from(atob(signature), (value) => value.charCodeAt(0))
    if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(token))) return null
  } catch { return null }
  const [row] = await db.select({ userId: session.userId }).from(session).where(and(eq(session.token, token), gt(session.expiresAt, new Date()))).limit(1)
  return row?.userId ?? null
}

export async function getPasswordChangeSubject(): Promise<Subject | null> {
  const userId = await backendSessionUserId()
  if (userId) {
    const [row] = await db.select({ phone: user.phoneNumber }).from(user).where(eq(user.id, userId)).limit(1)
    if (!row?.phone) throw new PasswordChangeError('当前账号尚未绑定手机号，请联系管理员', 403)
    return { type: 'user', id: userId, phone: row.phone }
  }
  const portal = await sessionPortal()
  if (portal) return { type: 'customer', id: portal.phone, phone: portal.phone }
  const phone = await sessionPhone()
  return phone ? { type: 'customer', id: phone, phone } : null
}

export function maskPasswordPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

export async function requestPasswordChangeCode(subject: Subject, requestIp: string) {
  const now = new Date()
  const minuteAgo = new Date(now.getTime() - 60_000)
  const hourAgo = new Date(now.getTime() - 3_600_000)
  const ipHash = digest(`${requestIp}.${secret}`)
  const [[recent], [hourly]] = await Promise.all([
    db.select({ id: passwordChangeChallenges.id }).from(passwordChangeChallenges).where(and(eq(passwordChangeChallenges.subjectType, subject.type), eq(passwordChangeChallenges.subjectId, subject.id), gt(passwordChangeChallenges.createdAt, minuteAgo))).limit(1),
    db.select({ value: count() }).from(passwordChangeChallenges).where(and(eq(passwordChangeChallenges.phone, subject.phone), gt(passwordChangeChallenges.createdAt, hourAgo))),
  ])
  if (recent) throw new PasswordChangeError('请求过于频繁，请一分钟后再试', 429, RESEND_SECONDS)
  if (Number(hourly?.value ?? 0) >= 5) throw new PasswordChangeError('验证码请求次数已达上限，请稍后再试', 429, 3600)
  const code = String(randomInt(100000, 1000000))
  await sendSms(subject.phone, code)
  await db.update(passwordChangeChallenges).set({ consumedAt: now }).where(and(eq(passwordChangeChallenges.subjectType, subject.type), eq(passwordChangeChallenges.subjectId, subject.id), isNull(passwordChangeChallenges.consumedAt)))
  await db.insert(passwordChangeChallenges).values({ subjectType: subject.type, subjectId: subject.id, phone: subject.phone, codeHash: digest(`${subject.type}.${subject.id}.${code}.${secret}`), expiresAt: new Date(now.getTime() + EXPIRES_SECONDS * 1000), requestIpHash: ipHash })
  return { retryAfter: RESEND_SECONDS, expiresIn: EXPIRES_SECONDS }
}

export async function applyVerifiedPasswordChange(subject: Subject, code: string, newPassword: string) {
  if (!/^\d{6}$/.test(code)) throw new PasswordChangeError('请输入 6 位验证码')
  if (newPassword.length < 8 || newPassword.length > 128) throw new PasswordChangeError('新密码需为 8 至 128 位')
  const [challenge] = await db.select().from(passwordChangeChallenges).where(and(eq(passwordChangeChallenges.subjectType, subject.type), eq(passwordChangeChallenges.subjectId, subject.id), isNull(passwordChangeChallenges.consumedAt), gt(passwordChangeChallenges.expiresAt, new Date()))).orderBy(desc(passwordChangeChallenges.createdAt)).limit(1)
  if (!challenge) throw new PasswordChangeError('验证码已过期，请重新获取')
  const expected = Buffer.from(challenge.codeHash, 'hex')
  const actual = Buffer.from(digest(`${subject.type}.${subject.id}.${code}.${secret}`), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const attempts = challenge.attempts + 1
    await db.update(passwordChangeChallenges).set({ attempts, consumedAt: attempts >= 5 ? new Date() : null }).where(eq(passwordChangeChallenges.id, challenge.id))
    throw new PasswordChangeError(attempts >= 5 ? '尝试次数过多，请重新获取验证码' : '验证码不正确，请重新输入', attempts >= 5 ? 429 : 400, attempts >= 5 ? RESEND_SECONDS : undefined)
  }
  const now = new Date()
  await db.update(passwordChangeChallenges).set({ consumedAt: now }).where(eq(passwordChangeChallenges.id, challenge.id))
  if (subject.type === 'user') {
    const [credential] = await db.select({ id: account.id }).from(account).where(and(eq(account.userId, subject.id), eq(account.providerId, 'credential'))).limit(1)
    if (!credential) throw new PasswordChangeError('当前账号没有密码登录凭据', 403)
    await db.transaction(async (tx) => {
      await tx.update(account).set({ password: hashBackendPassword(newPassword), updatedAt: now }).where(eq(account.id, credential.id))
      await tx.delete(session).where(eq(session.userId, subject.id))
    })
  } else {
    await db.transaction(async (tx) => {
      await tx.update(customerPortals).set({ passwordHash: hashPortalPassword(newPassword), sessionVersion: sql`${customerPortals.sessionVersion} + 1`, failedAttempts: 0, lockedUntil: null, updatedAt: now }).where(and(eq(customerPortals.phone, subject.phone), eq(customerPortals.status, 'active')))
      await tx.delete(customerPhoneSessions).where(eq(customerPhoneSessions.phone, subject.phone))
    })
  }
}
