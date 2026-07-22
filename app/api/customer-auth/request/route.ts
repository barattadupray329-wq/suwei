import { NextResponse } from 'next/server'
import { CustomerOtpError, getPhoneIdentities, requestCustomerOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'
import { auth } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const body = await request.json() as { phone?: unknown }
    const phone = String(body.phone ?? '')
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const identities = await getPhoneIdentities(phone)
    if (identities.workspace) {
      await auth.api.sendPhoneNumberOTP({ body: { phoneNumber: identities.phone }, headers: request.headers })
      return NextResponse.json({ ok: true, message: '验证码已发送', retryAfter: 60, expiresIn: 300 })
    }
    const result = await requestCustomerOtp(phone, forwarded)
    return NextResponse.json({ ok: true, message: '如果该手机号存在可用身份，验证码将在稍后送达', retryAfter: result.retryAfter, expiresIn: result.expiresIn })
  } catch (error) {
    const otpError = error instanceof CustomerOtpError || (error instanceof Error && error.name === 'CustomerOtpError') ? error as CustomerOtpError : new CustomerOtpError('验证码发送失败，请稍后重试', 500)
    return NextResponse.json({ ok: false, message: otpError.message, retryAfter: otpError.retryAfter }, { status: otpError.status, headers: otpError.retryAfter ? { 'Retry-After': String(otpError.retryAfter) } : undefined })
  }
}
