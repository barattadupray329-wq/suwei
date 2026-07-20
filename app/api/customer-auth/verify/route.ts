import { NextResponse } from 'next/server'
import { verifyCustomerOtp } from '@/lib/customer-phone-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await verifyCustomerOtp(String(body.phone ?? ''), String(body.code ?? ''))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '验证失败' }, { status: 400 })
  }
}
