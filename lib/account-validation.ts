import { z } from 'zod'

export const ACCOUNT_PERMISSIONS = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置'] as const
export type AccountPermission = (typeof ACCOUNT_PERMISSIONS)[number]

export const accountNameSchema = z.string().trim().min(2, '姓名至少需要 2 个字').max(40, '姓名最多 40 个字')
export const accountUsernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, '用户名需为 3-32 位字母、数字或下划线')
export const accountPhoneSchema = z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().regex(/^1\d{10}$/, '请输入有效的 11 位手机号'))
export const accountPasswordSchema = z.string().min(8, '密码至少需要 8 位').max(128, '密码最多 128 位')

export function validateAccountPermissions(permissions: string[]) {
  const unique = [...new Set(permissions)]
  if (unique.length === 0) throw new Error('请至少选择一项权限')
  if (unique.some((permission) => !ACCOUNT_PERMISSIONS.includes(permission as AccountPermission))) {
    throw new Error('包含无效的账号权限')
  }
  return unique as AccountPermission[]
}

export function validatePasswordConfirmation(input: { newPassword: string; confirmPassword: string }) {
  const password = accountPasswordSchema.parse(input.newPassword)
  if (password !== input.confirmPassword) throw new Error('两次输入的新密码不一致')
  return password
}
