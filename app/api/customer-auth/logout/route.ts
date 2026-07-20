import { NextResponse } from 'next/server'
import { logoutCustomerPhone } from '@/lib/customer-phone-auth'

export async function POST(request: Request) {
  await logoutCustomerPhone()
  return NextResponse.redirect(new URL('/customer-login', request.url), 303)
}
