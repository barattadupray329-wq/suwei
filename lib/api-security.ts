import { NextResponse } from 'next/server'
import { z, type ZodType } from 'zod'

const MAX_JSON_BYTES = 16 * 1024

export class ApiRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_JSON_BYTES) {
    throw new ApiRequestError('请求内容过大', 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiRequestError('请求内容不是有效的 JSON', 400)
  }

  const result = schema.safeParse(body)
  if (!result.success) throw new ApiRequestError(result.error.issues[0]?.message ?? '请求内容格式不正确', 400)
  return result.data
}

export function apiError(error: unknown, fallback = '操作失败，请稍后重试') {
  const known = error instanceof ApiRequestError || (error instanceof Error && error.name === 'CustomerOtpError')
  if (known) {
    const detail = error as Error & { status?: number; retryAfter?: number }
    const status = detail.status && detail.status >= 400 && detail.status < 600 ? detail.status : 400
    return NextResponse.json(
      { ok: false, message: detail.message, ...(detail.retryAfter ? { retryAfter: detail.retryAfter } : {}) },
      { status, headers: detail.retryAfter ? { 'Retry-After': String(detail.retryAfter) } : undefined },
    )
  }
  return NextResponse.json({ ok: false, message: fallback }, { status: 500 })
}

export const phoneSchema = z.object({
  phone: z.string().trim().regex(/^1\d{10}$/, '请输入正确的中国大陆手机号'),
}).strict()

export const phoneCodeSchema = phoneSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, '请输入 6 位验证码'),
}).strict()

export const passwordLoginSchema = z.object({
  identity: z.string().trim().min(1).max(100).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
}).strict()
