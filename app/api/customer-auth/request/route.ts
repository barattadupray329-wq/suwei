import { NextResponse } from 'next/server'
import { requestCustomerOtp } from '@/lib/customer-phone-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    await requestCustomerOtp(String(body.phone ?? ''), forwarded)
    return NextResponse.json({ ok: true, message: '如果该手机号存在有效在租记录，验证码将发送到您的手机' })
  } catch (error) {
    const message = error instanceof Error ? error.message : '验证码发送失败'
    return NextResponse.json({ ok: false, message }, { status: message.includes('尚未配置') ? 503 : 400 })
  }
}
