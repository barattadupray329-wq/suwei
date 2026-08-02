import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const proxySource = readFileSync('proxy.ts', 'utf8')

describe('错误路由占位符兜底', () => {
  test('将误打开的 :path* 地址自动重定向到首页', () => {
    expect(proxySource).toContain("new Set(['/:path*', '/:path'])")
    expect(proxySource).toContain("homeUrl.pathname = '/'")
    expect(proxySource).toContain('NextResponse.redirect(homeUrl, 307)')
  })

  test('其他正常业务路径继续交给 Next.js 处理', () => {
    expect(proxySource).toContain('return NextResponse.next()')
  })
})
