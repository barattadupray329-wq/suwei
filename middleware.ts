import { NextRequest, NextResponse } from 'next/server'

const INVALID_PLACEHOLDER_PATHS = new Set(['/:path*', '/:path'])

export function middleware(request: NextRequest) {
  let pathname = request.nextUrl.pathname

  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    // 保留原始路径，由 Next.js 按普通无效地址处理。
  }

  if (!INVALID_PLACEHOLDER_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  const homeUrl = request.nextUrl.clone()
  homeUrl.pathname = '/'
  homeUrl.search = ''
  return NextResponse.redirect(homeUrl, 307)
}

export const config = {
  matcher: ['/:path*'],
}
