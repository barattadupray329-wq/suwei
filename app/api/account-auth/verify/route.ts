import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifyCustomerOtp } from '@/lib/customer-phone-auth'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  const body = await request.json() as { phone?: string; code?: string }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  const code = String(body.code ?? '').trim()
  const [staff] = await db.select({ id: user.id, active: accountProfiles.active }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(eq(user.phoneNumber, phone)).limit(1)
  try {
    if (staff?.id && staff.active) {
      return await auth.api.verifyPhoneNumber({ body: { phoneNumber: phone, code }, headers: request.headers, asResponse: true })
    }
    await verifyCustomerOtp(phone, code)
    return NextResponse.json({ ok: true, destination: 'customer' })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : '验证码不正确或已过期' }, { status: 401 })
  }
}
