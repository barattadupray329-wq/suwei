import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountProfiles, organizationMembers, rentals } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export type ModulePermission = '租赁操作' | '资金查看' | '合同管理' | '账号管理' | '系统设置'

export async function getAccessContext(permission?: ModulePermission) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('未登录')
  const [profile] = await db.select().from(accountProfiles).where(eq(accountProfiles.userId, session.user.id))
  if (!profile?.active) throw new Error('账号未授权或已停用')
  const allPermissions: ModulePermission[] = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置']
  if (profile.role === 'super_admin' || profile.role === 'admin') {
    return {
      userId: session.user.id,
      actorId: session.user.id,
      actorName: session.user.name,
      role: profile.role as 'super_admin' | 'admin',
      permissions: allPermissions,
    }
  }
  if (profile.role !== 'employee') throw new Error('账号角色无效')
  const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.memberUserId, session.user.id))
  if (!membership?.active || membership.role !== 'employee') throw new Error('账号未加入店铺或已停用')
  const permissions = membership.permissions.split(',').filter(Boolean) as ModulePermission[]
  if (permission && !permissions.includes(permission)) throw new Error('没有该模块的操作权限')
  return { userId: membership.ownerId, actorId: session.user.id, actorName: session.user.name, role: 'employee' as const, permissions }
}

export async function getStoreAccessContext(permission?: ModulePermission) {
  const access = await getAccessContext(permission)
  if (access.role === 'super_admin') throw new Error('超级管理员不属于任何店铺，无法访问店铺业务数据')
  return access
}

export async function requireRentalAccess(rentalId: number, permission: ModulePermission = '租赁操作') {
  const access = await getStoreAccessContext(permission)
  const filters = [eq(rentals.id, rentalId), eq(rentals.userId, access.userId)]
  if (access.role === 'employee') filters.push(eq(rentals.assignedEmployeeId, access.actorId))
  const [rental] = await db.select({ id: rentals.id }).from(rentals).where(and(...filters))
  if (!rental) throw new Error('合同不存在或不在你的负责范围内')
  return access
}
