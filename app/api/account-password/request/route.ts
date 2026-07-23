import { NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { account, accountProfiles, user } from '@/lib/db/schema'
import { CustomerOtpError, maskCustomerPhone, requestStaffPasswordOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const body = await request.json() as { account?: unknown }
    const login = String(body.account ?? '').trim()
    const [profile] = login ? await db.select({ userId: user.id, phone: user.phoneNumber }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential'))).where(and(or(eq(user.username, login), eq(user.email, login)), eq(accountProfiles.active, true))).limit(1) : []
    const phone = profile?.phone && /^1\d{10}$/.test(profile.phone) ? profile.phone : '10000000000'
    const requestIp = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    await requestStaffPasswordOtp(phone, requestIp, Boolean(profile?.phone))
    return NextResponse.json({ ok: true, message: '如账号有效且已绑定手机号，验证码将发送至绑定手机', phoneMask: profile?.phone ? maskCustomerPhone(profile.phone) : '' })
  } catch (error) {
    const status = error instanceof CustomerOtpError ? error.status : 500
    const message = error instanceof CustomerOtpError ? error.message : '验证码请求失败，请稍后重试'
    return NextResponse.json({ ok: false, message, retryAfter: error instanceof CustomerOtpError ? error.retryAfter : undefined }, { status })
  }
}
