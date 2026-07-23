import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { apiError, parseJson, phoneCodeSchema } from '@/lib/api-security'
import { auth } from '@/lib/auth'
import { ensureDailyCloudSnapshot } from '@/lib/backup'
import { verifyCustomerOtp } from '@/lib/customer-phone-auth'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
    const { phone, code } = await parseJson(request, phoneCodeSchema)
    const [staff] = await db.select({ id: user.id, role: accountProfiles.role, active: accountProfiles.active }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).where(eq(user.phoneNumber, phone)).limit(1)
    if (staff?.id && staff.active) {
      const response = await auth.api.verifyPhoneNumber({ body: { phoneNumber: phone, code }, headers: request.headers, asResponse: true })
      if (response.ok && (staff.role === 'admin' || staff.role === 'super_admin')) await ensureDailyCloudSnapshot(staff.id).catch(() => undefined)
      return response
    }
    await verifyCustomerOtp(phone, code)
    return NextResponse.json({ ok: true, destination: 'customer' })
  } catch (error) {
    const response = apiError(error, '验证码不正确或已过期')
    return response.status >= 500 ? NextResponse.json({ message: '验证码不正确或已过期' }, { status: 401 }) : response
  }
}
