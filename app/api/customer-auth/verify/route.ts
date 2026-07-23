import { NextResponse } from 'next/server'
import { apiError, parseJson, phoneCodeSchema } from '@/lib/api-security'
import { verifyCustomerOtp } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const { phone, code } = await parseJson(request, phoneCodeSchema)
    await verifyCustomerOtp(phone, code)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, '验证失败，请稍后重试')
  }
}
