import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountProfiles, organizationMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export type ModulePermission = '租赁操作' | '资金查看' | '合同管理' | '账号管理' | '系统设置'

export async function getAccessContext(permission?: ModulePermission) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('未登录')
  const [profile] = await db.select().from(accountProfiles).where(eq(accountProfiles.userId, session.user.id))
  if (!profile?.active) throw new Error('账号未授权或已停用')
  const allPermissions: ModulePermission[] = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置']
  if (profile.role === 'super_admin') return { userId: session.user.id, actorId: session.user.id, actorName: session.user.name, role: 'super_admin' as const, permissions: allPermissions }
  const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.memberUserId, session.user.id))
  if (!membership?.active) throw new Error('账号未加入组织或已停用')
  const permissions = membership.permissions.split(',').filter(Boolean) as ModulePermission[]
  if (permission && !permissions.includes(permission)) throw new Error('没有该模块的操作权限')
  const role = profile.role === 'admin' ? 'admin' as const : 'employee' as const
  return { userId: membership.ownerId, actorId: session.user.id, actorName: session.user.name, role, permissions }
}
