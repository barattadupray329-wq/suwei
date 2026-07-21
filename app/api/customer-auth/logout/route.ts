import { NextResponse } from 'next/server'
import { logoutCustomerPhone } from '@/lib/customer-phone-auth'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
  await logoutCustomerPhone()
  return NextResponse.redirect(new URL('/customer-login', request.url), 303)
}
