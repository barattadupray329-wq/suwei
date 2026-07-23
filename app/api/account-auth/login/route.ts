import { eq, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { apiError, parseJson, passwordLoginSchema } from '@/lib/api-security'
import { auth } from '@/lib/auth'
import { ensureDailyCloudSnapshot } from '@/lib/backup'
import { db } from '@/lib/db'
import { accountProfiles, user } from '@/lib/db/schema'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
    const { identity, password } = await parseJson(request, passwordLoginSchema)
    const [candidate] = await db.select({ id: user.id, username: user.username, role: accountProfiles.role, active: accountProfiles.active })
      .from(user)
      .leftJoin(accountProfiles, eq(accountProfiles.userId, user.id))
      .where(or(eq(user.username, identity), eq(user.phoneNumber, identity)))
      .limit(1)
    if (!candidate?.username || candidate.active === false) return NextResponse.json({ message: '账号或密码不正确' }, { status: 401 })

    const response = await auth.api.signInUsername({ body: { username: candidate.username, password, rememberMe: true }, headers: request.headers, asResponse: true })
    if (response.ok && candidate.id && (candidate.role === 'admin' || candidate.role === 'super_admin')) {
      await ensureDailyCloudSnapshot(candidate.id).catch(() => undefined)
    }
    return response
  } catch (error) {
    const response = apiError(error, '账号或密码不正确')
    return response.status >= 500 ? NextResponse.json({ message: '账号或密码不正确' }, { status: 401 }) : response
  }
}
