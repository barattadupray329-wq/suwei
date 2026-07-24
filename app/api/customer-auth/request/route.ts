import { NextResponse } from 'next/server'
import { CustomerOtpError, getPhoneIdentities, requestCustomerOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const body = await request.json() as { phone?: unknown; consent?: unknown }
    if (body.consent !== true) return NextResponse.json({ ok: false, message: '请先阅读并同意用户协议和隐私政策' }, { status: 400 })
    const phone = String(body.phone ?? '')
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const identities = await getPhoneIdentities(phone)
    if (!identities.workspace && !identities.customer) throw new CustomerOtpError('当前没有可使用的账号或在租信息', 403)
    const result = await requestCustomerOtp(phone, forwarded)
    return NextResponse.json({ ok: true, message: '验证码已发送', shopName: identities.shopName, retryAfter: result.retryAfter, expiresIn: result.expiresIn })
  } catch (error) {
    const otpError = error instanceof CustomerOtpError || (error instanceof Error && error.name === 'CustomerOtpError') ? error as CustomerOtpError : new CustomerOtpError('验证码发送失败，请稍后重试', 500)
    return NextResponse.json({ ok: false, message: otpError.message, retryAfter: otpError.retryAfter }, { status: otpError.status, headers: otpError.retryAfter ? { 'Retry-After': String(otpError.retryAfter) } : undefined })
  }
}
