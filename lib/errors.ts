import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

const accessErrors = new Map([
  ['未登录', 401],
  ['账号已停用', 403],
  ['没有该模块的操作权限', 403],
])

export function safeError(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error instanceof AppError) return { message: error.message, status: error.status }
  if (error instanceof ZodError) return { message: error.issues[0]?.message || '提交内容格式不正确', status: 400 }
  if (error instanceof Error) {
    const status = accessErrors.get(error.message)
    if (status) return { message: error.message, status }
  }
  return { message: fallback, status: 500 }
}
