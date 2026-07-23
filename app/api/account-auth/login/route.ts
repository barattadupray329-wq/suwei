import { eq, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'
import { ensureDailyCloudSnapshot } from '@/lib/backup'

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  const body = await request.json() as { identity?: string; password?: string }
  const identity = String(body.identity ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!identity || password.length < 8) return NextResponse.json({ message: '账号或密码不正确' }, { status: 401 })

  const [candidate] = await db.select({ id: user.id, username: user.username, role: accountProfiles.role, active: accountProfiles.active })
    .from(user)
    .leftJoin(accountProfiles, eq(accountProfiles.userId, user.id))
    .where(or(eq(user.username, identity), eq(user.phoneNumber, identity)))
    .limit(1)
  if (!candidate?.username || candidate.active === false) return NextResponse.json({ message: '账号或密码不正确' }, { status: 401 })

  try {
    const response = await auth.api.signInUsername({
      body: { username: candidate.username, password, rememberMe: true },
      headers: request.headers,
      asResponse: true,
    })
    if (response.ok && candidate.id && (candidate.role === 'admin' || candidate.role === 'super_admin')) {
      await ensureDailyCloudSnapshot(candidate.id).catch(() => undefined)
    }
    return response
  } catch {
    return NextResponse.json({ message: '账号或密码不正确' }, { status: 401 })
  }
}
