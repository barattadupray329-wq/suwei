import { NextResponse } from 'next/server'
import { apiError, parseJson, phoneSchema } from '@/lib/api-security'
import { requestCustomerOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const { phone } = await parseJson(request, phoneSchema)
    const forwarded = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const result = await requestCustomerOtp(phone, forwarded)
    return NextResponse.json({ ok: true, message: '如果该手机号存在有效租赁记录，验证码将在稍后送达', retryAfter: result.retryAfter, expiresIn: result.expiresIn })
  } catch (error) {
    return apiError(error, '验证码发送失败，请稍后重试')
  }
}
