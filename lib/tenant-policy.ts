export const STORE_PERMISSIONS = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置'] as const
export type StorePermission = (typeof STORE_PERMISSIONS)[number]
export type AccountRole = 'super_admin' | 'admin' | 'employee'

export function permissionsForRole(role: AccountRole, employeePermissions: string[] = []): StorePermission[] {
  if (role === 'super_admin') return ['账号管理']
  if (role === 'admin') return [...STORE_PERMISSIONS]
  return employeePermissions.filter((permission): permission is StorePermission => permission !== '账号管理' && STORE_PERMISSIONS.includes(permission as StorePermission))
}

export function canAccessStoreModule(role: AccountRole, permission: StorePermission, employeePermissions: string[] = []) {
  return permissionsForRole(role, employeePermissions).includes(permission)
}

const permissionRoutes: Record<StorePermission, string> = {
  租赁操作: '/dashboard',
  资金查看: '/finance',
  合同管理: '/customer-portals',
  账号管理: '/accounts',
  系统设置: '/settings',
}

export function defaultAccountRoute(role: AccountRole, employeePermissions: string[] = []) {
  if (role === 'super_admin') return '/accounts'
  if (role === 'admin') return '/dashboard'
  const [firstPermission] = permissionsForRole('employee', employeePermissions)
  return firstPermission ? permissionRoutes[firstPermission] : null
}

export function resolveStoreId(input: { role: AccountRole; actorId: string; ownedStoreId?: string | null; memberStoreId?: string | null }) {
  if (input.role === 'super_admin') return null
  if (input.role === 'admin') return input.ownedStoreId ?? null
  return input.memberStoreId ?? null
}

export function assertSingleStoreMembership(storeIds: Array<string | null | undefined>) {
  const unique = new Set(storeIds.filter((storeId): storeId is string => Boolean(storeId)))
  if (unique.size > 1) throw new Error('该手机号已属于其他店铺')
  return unique.values().next().value as string | undefined
}

export function isCustomerReadOnlyStatus(status: string) {
  return ['在租', '即将到期', '逾期'].includes(status)
}
