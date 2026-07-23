import { NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { db } from '@/lib/db'
import { account, accountProfiles, auditLogs, organizationMembers, session, user } from '@/lib/db/schema'
import { CustomerOtpError, verifyStaffPasswordOtp } from '@/lib/customer-phone-auth'
import { validatePasswordConfirmation } from '@/lib/account-validation'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ ok: false, message: '请求来源无效' }, { status: 403 })
    const body = await request.json() as { account?: unknown; phone?: unknown; code?: unknown; newPassword?: unknown; confirmPassword?: unknown }
    const login = String(body.account ?? '').trim()
    const submittedPhone = String(body.phone ?? '').trim()
    const newPassword = validatePasswordConfirmation({ newPassword: String(body.newPassword ?? ''), confirmPassword: String(body.confirmPassword ?? '') })
    const [profile] = login ? await db.select({ id: user.id, name: user.name, phone: user.phoneNumber, credentialId: account.id, role: accountProfiles.role }).from(user).innerJoin(accountProfiles, eq(accountProfiles.userId, user.id)).innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential'))).where(and(or(eq(user.username, login), eq(user.email, login)), eq(accountProfiles.active, true))).limit(1) : []
    if (!profile?.phone || !/^1\d{10}$/.test(submittedPhone) || profile.phone !== submittedPhone) throw new CustomerOtpError('账号、验证码或绑定手机号不正确', 400)
    await verifyStaffPasswordOtp(submittedPhone, String(body.code ?? ''))
    await db.update(account).set({ password: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(account.id, profile.credentialId))
    await db.delete(session).where(eq(session.userId, profile.id))
    const ownerId = profile.role === 'employee' ? (await db.select({ ownerId: organizationMembers.ownerId }).from(organizationMembers).where(eq(organizationMembers.memberUserId, profile.id)).limit(1))[0]?.ownerId : profile.id
    if (ownerId) await db.insert(auditLogs).values({ userId: ownerId, actorUserId: profile.id, actorName: profile.name, action: '短信验证修改密码', resourceType: '账号', resourceId: profile.id, summary: `${profile.name}通过绑定手机号验证修改登录密码`, metadata: { phone: submittedPhone.slice(0, 3) + '****' + submittedPhone.slice(-4) } })
    return NextResponse.json({ ok: true, message: '密码已修改，请使用新密码重新登录' })
  } catch (error) {
    const status = error instanceof CustomerOtpError ? error.status : 400
    const message = error instanceof Error ? error.message : '密码修改失败'
    return NextResponse.json({ ok: false, message }, { status })
  }
}
