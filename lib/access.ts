import { getCurrentSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountProfiles, organizationMembers, shops } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canAccessStoreModule, defaultAccountRoute, permissionsForRole, type StorePermission } from '@/lib/tenant-policy'
import { cache } from 'react'

export type ModulePermission = StorePermission

const getBaseAccessContext = cache(async () => {
  const session = await getCurrentSession()
  if (!session?.user) throw new Error('未登录')
  const [profile] = await db.select().from(accountProfiles).where(eq(accountProfiles.userId, session.user.id))
  if (!profile?.active) throw new Error('账号未授权或已停用')
  if (profile.role === 'super_admin') {
    return { userId: session.user.id, shopId: null, shopName: '平台管理', actorId: session.user.id, actorName: session.user.name, role: 'super_admin' as const, permissions: permissionsForRole('super_admin') }
  }
  if (profile.role === 'admin') {
    const [shop] = await db.select().from(shops).where(eq(shops.ownerUserId, session.user.id))
    if (!shop || shop.status !== 'active') throw new Error('店铺未启用或已暂停')
    return { userId: shop.id, shopId: shop.id, shopName: shop.name, actorId: session.user.id, actorName: session.user.name, role: 'admin' as const, permissions: permissionsForRole('admin') }
  }
  if (profile.role !== 'employee') throw new Error('账号角色无效')
  const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.memberUserId, session.user.id))
  if (!membership?.active || membership.role !== 'employee') throw new Error('账号未加入店铺或已停用')
  const permissions = permissionsForRole('employee', membership.permissions.split(',').filter(Boolean))
  if (!permissions.length) throw new Error('客户经理账号未分配任何功能权限')
  const [shop] = await db.select().from(shops).where(eq(shops.id, membership.shopId ?? membership.ownerId))
  if (!shop || shop.status !== 'active') throw new Error('所属店铺未启用或已暂停')
  return { userId: shop.id, shopId: shop.id, shopName: shop.name, actorId: session.user.id, actorName: session.user.name, role: 'employee' as const, permissions }
})

export async function getAccessContext(permission?: ModulePermission) {
  const access = await getBaseAccessContext()
  if (permission && !canAccessStoreModule(access.role, permission, access.permissions)) {
    if (access.role === 'super_admin') throw new Error('平台主管不能访问店铺业务数据')
    throw new Error('没有该模块的操作权限')
  }
  return access
}

export async function getDefaultAccountRoute() {
  const access = await getAccessContext()
  const route = defaultAccountRoute(access.role, access.permissions)
  if (!route) throw new Error('客户经理账号未分配任何功能权限')
  return route
}
