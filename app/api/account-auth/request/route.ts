import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { apiError, parseJson, phoneSchema } from '@/lib/api-security'
import { auth } from '@/lib/auth'
import { requestCustomerOtp } from '@/lib/customer-phone-auth'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
    const { phone } = await parseJson(request, phoneSchema)
    const [staff] = await db.select({ id: user.id, active: accountProfiles.active }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(eq(user.phoneNumber, phone)).limit(1)
    if (staff?.id && staff.active) await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: phone }, headers: request.headers })
    else {
      const forwarded = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
      await requestCustomerOtp(phone, forwarded)
    }
    return NextResponse.json({ ok: true, message: '如果该手机号已开通，验证码将在稍后送达', retryAfter: 60, expiresIn: 300 })
  } catch (error) {
    return apiError(error, '验证码发送失败，请稍后重试')
  }
}
