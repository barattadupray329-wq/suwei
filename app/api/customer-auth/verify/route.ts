import { NextResponse } from 'next/server'
import { CustomerOtpError, verifyCustomerOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const body = await request.json() as { phone?: unknown; code?: unknown }
    await verifyCustomerOtp(String(body.phone ?? ''), String(body.code ?? ''))
    return NextResponse.json({ ok: true })
  } catch (error) {
    const otpError = error instanceof CustomerOtpError || (error instanceof Error && error.name === 'CustomerOtpError') ? error as CustomerOtpError : new CustomerOtpError('验证失败，请稍后重试', 500)
    return NextResponse.json({ ok: false, message: otpError.message, retryAfter: otpError.retryAfter }, { status: otpError.status, headers: otpError.retryAfter ? { 'Retry-After': String(otpError.retryAfter) } : undefined })
  }
}
