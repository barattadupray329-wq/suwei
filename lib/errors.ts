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
  ['账号未授权或已停用', 403],
  ['账号角色无效', 403],
  ['店铺未启用或已暂停', 403],
  ['账号未加入店铺或已停用', 403],
  ['所属店铺未启用或已暂停', 403],
  ['客户经理账号未分配任何功能权限', 403],
  ['没有该模块的操作权限', 403],
  ['平台主管不能访问店铺业务数据', 403],
])

const technicalErrorPatterns = [
  /sql|sqlite|postgres|drizzle|database|constraint|unique|foreign key/i,
  /stack| at |node_modules|https?:\/\/|\.ts:\d+|\.js:\d+/i,
  /secret|token|password|authorization|credential|api[_ -]?key/i,
]

const localizedErrors: Array<[RegExp, string, number]> = [
  [/unauthorized|not authenticated|authentication required|invalid session/i, '登录状态已失效，请重新登录', 401],
  [/forbidden|permission denied|access denied|not allowed/i, '没有执行此操作的权限', 403],
  [/network|failed to fetch|fetch failed|load failed|connection|econn|socket/i, '网络连接失败，请检查网络后重试', 503],
  [/timeout|timed out|deadline exceeded/i, '请求超时，请稍后重试', 504],
  [/not found|does not exist/i, '未找到相关记录', 404],
  [/already exists|duplicate|unique constraint/i, '该记录已存在，请勿重复提交', 409],
  [/invalid json|unexpected token.*json|json parse/i, '服务器返回内容异常，请稍后重试', 502],
  [/too many requests|rate limit/i, '操作过于频繁，请稍后再试', 429],
]

function hasChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function isSafeBusinessMessage(value: string) {
  return value.length <= 160 && hasChinese(value) && !value.includes('\uFFFD') && !technicalErrorPatterns.some((pattern) => pattern.test(value))
}

export function userErrorMessage(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error instanceof ZodError) return error.issues[0]?.message || '提交内容格式不正确'
  if (!(error instanceof Error)) return fallback
  if (isSafeBusinessMessage(error.message)) return error.message
  return localizedErrors.find(([pattern]) => pattern.test(error.message))?.[1] || fallback
}

export function safeError(error: unknown, fallback = '操作失败，请稍后重试') {
  if (error instanceof AppError) return { message: error.message, status: error.status }
  if (error instanceof ZodError) return { message: userErrorMessage(error, fallback), status: 400 }
  if (error instanceof Error) {
    const status = accessErrors.get(error.message)
    if (status) return { message: error.message, status }
    const localized = localizedErrors.find(([pattern]) => pattern.test(error.message))
    if (localized) return { message: localized[1], status: localized[2] }
    if (isSafeBusinessMessage(error.message)) return { message: error.message, status: 400 }
  }
  return { message: fallback, status: 500 }
}
