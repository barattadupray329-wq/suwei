import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountProfiles, organizationMembers, shops } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export type ModulePermission = '租赁操作' | '资金查看' | '合同管理' | '账号管理' | '系统设置'

export async function getAccessContext(permission?: ModulePermission) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('未登录')
  const [profile] = await db.select().from(accountProfiles).where(eq(accountProfiles.userId, session.user.id))
  if (!profile?.active) throw new Error('账号未授权或已停用')
  const allPermissions: ModulePermission[] = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置']
  if (profile.role === 'super_admin') {
    if (permission && permission !== '账号管理') throw new Error('超级管理员不能访问店铺业务数据')
    return { userId: session.user.id, shopId: null, shopName: '平台管理', actorId: session.user.id, actorName: session.user.name, role: 'super_admin' as const, permissions: ['账号管理'] as ModulePermission[] }
  }
  if (profile.role === 'admin') {
    const [shop] = await db.select().from(shops).where(eq(shops.ownerUserId, session.user.id))
    if (!shop || shop.status !== 'active') throw new Error('店铺未启用或已暂停')
    return { userId: shop.id, shopId: shop.id, shopName: shop.name, actorId: session.user.id, actorName: session.user.name, role: 'admin' as const, permissions: allPermissions }
  }
  if (profile.role !== 'employee') throw new Error('账号角色无效')
  const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.memberUserId, session.user.id))
  if (!membership?.active || membership.role !== 'employee') throw new Error('账号未加入店铺或已停用')
  const permissions = membership.permissions.split(',').filter(Boolean) as ModulePermission[]
  if (permission && !permissions.includes(permission)) throw new Error('没有该模块的操作权限')
  const [shop] = await db.select().from(shops).where(eq(shops.id, membership.shopId ?? membership.ownerId))
  if (!shop || shop.status !== 'active') throw new Error('所属店铺未启用或已暂停')
  return { userId: shop.id, shopId: shop.id, shopName: shop.name, actorId: session.user.id, actorName: session.user.name, role: 'employee' as const, permissions }
}
