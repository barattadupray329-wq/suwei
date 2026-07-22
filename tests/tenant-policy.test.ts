import { describe, expect, it } from 'vitest'
import { assertSingleStoreMembership, canAccessStoreModule, isCustomerReadOnlyStatus, permissionsForRole, resolveStoreId } from '../lib/tenant-policy'

describe('多店铺权限边界', () => {
  it('超级管理员只能管理账号，不能访问店铺业务', () => {
    expect(permissionsForRole('super_admin')).toEqual(['账号管理'])
    expect(canAccessStoreModule('super_admin', '账号管理')).toBe(true)
    expect(canAccessStoreModule('super_admin', '租赁操作')).toBe(false)
    expect(canAccessStoreModule('super_admin', '资金查看')).toBe(false)
    expect(resolveStoreId({ role: 'super_admin', actorId: 'root', ownedStoreId: 'shop-a' })).toBeNull()
  })

  it('管理员只能解析到自己的店铺', () => {
    expect(resolveStoreId({ role: 'admin', actorId: 'admin-a', ownedStoreId: 'shop-a', memberStoreId: 'shop-b' })).toBe('shop-a')
    expect(permissionsForRole('admin')).toHaveLength(5)
  })

  it('员工权限必须来自所属店铺授权白名单', () => {
    expect(permissionsForRole('employee', ['租赁操作', '非法权限', '合同管理'])).toEqual(['租赁操作', '合同管理'])
    expect(canAccessStoreModule('employee', '资金查看', ['租赁操作'])).toBe(false)
    expect(resolveStoreId({ role: 'employee', actorId: 'staff', memberStoreId: 'shop-b' })).toBe('shop-b')
  })

  it('非管理员手机号不能跨店加入团队', () => {
    expect(assertSingleStoreMembership(['shop-a', 'shop-a'])).toBe('shop-a')
    expect(() => assertSingleStoreMembership(['shop-a', 'shop-b'])).toThrow('该手机号已属于其他店铺')
  })

  it('客户门户只显示当前在租状态', () => {
    expect(['在租', '即将到期', '逾期'].every(isCustomerReadOnlyStatus)).toBe(true)
    expect(['已归还', '已买断', '已取消'].some(isCustomerReadOnlyStatus)).toBe(false)
  })
})
