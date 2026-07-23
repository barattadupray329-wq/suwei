import { describe, expect, it } from 'vitest'
import { accountNameSchema, accountPasswordSchema, accountPhoneSchema, accountUsernameSchema, validateAccountPermissions, validatePasswordConfirmation } from '../lib/account-validation'

describe('账号安全校验', () => {
  it('去重并接受有效权限', () => {
    expect(validateAccountPermissions(['租赁操作', '资金查看', '租赁操作'])).toEqual(['租赁操作', '资金查看'])
  })

  it('拒绝空权限和非法权限', () => {
    expect(() => validateAccountPermissions([])).toThrow('请至少选择一项权限')
    expect(() => validateAccountPermissions(['超级管理员'])).toThrow('包含无效的账号权限')
  })

  it('拒绝无效姓名和弱密码', () => {
    expect(() => accountNameSchema.parse('A')).toThrow()
    expect(() => accountPasswordSchema.parse('1234567')).toThrow()
  })

  it('规范用户名并校验手机号', () => {
    expect(accountUsernameSchema.parse('  Admin_123  ')).toBe('admin_123')
    expect(accountPhoneSchema.parse('180 3980 8323')).toBe('18039808323')
    expect(() => accountUsernameSchema.parse('中文账号')).toThrow('用户名需为 3-32 位字母、数字或下划线')
    expect(() => accountPhoneSchema.parse('12345')).toThrow('请输入有效的 11 位手机号')
  })

  it('要求两次密码一致', () => {
    expect(() => validatePasswordConfirmation({ newPassword: 'secure-pass-123', confirmPassword: 'different-pass' })).toThrow('两次输入的新密码不一致')
    expect(validatePasswordConfirmation({ newPassword: 'secure-pass-123', confirmPassword: 'secure-pass-123' })).toBe('secure-pass-123')
  })
})
