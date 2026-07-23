import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requestCustomerOtp } from '@/lib/customer-phone-auth'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  const body = await request.json() as { phone?: string }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (!/^1\d{10}$/.test(phone)) return NextResponse.json({ message: '请输入正确的手机号' }, { status: 400 })
  const [staff] = await db.select({ id: user.id, active: accountProfiles.active }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(eq(user.phoneNumber, phone)).limit(1)
  try {
    if (staff?.id && staff.active) await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phone }, headers: request.headers })
    else {
      const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      await requestCustomerOtp(phone, forwarded)
    }
    return NextResponse.json({ ok: true, message: '验证码将在稍后送达', retryAfter: 60, expiresIn: 300 })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : '验证码发送失败' }, { status: 400 })
  }
}
