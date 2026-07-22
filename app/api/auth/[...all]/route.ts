import { auth } from '@/lib/auth'

const handler = auth.handler

function chineseError(status: number) {
  if (status === 400) return '登录信息格式不正确'
  if (status === 401) return '账号或密码不正确'
  if (status === 403) return '当前账号不可用，请联系管理员'
  if (status === 404) return '认证接口不存在'
  if (status === 429) return '操作过于频繁，请稍后再试'
  return '认证服务暂时不可用，请稍后重试'
}

async function handle(request: Request) {
  try {
    const response = await handler(request)
    if (response.ok || response.status < 400) return response
    const headers = new Headers(response.headers)
    headers.set('content-type', 'application/json; charset=utf-8')
    return Response.json({ error: chineseError(response.status) }, { status: response.status, headers })
  } catch {
    return Response.json({ error: '认证服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
