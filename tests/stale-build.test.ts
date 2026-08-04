import { describe, expect, it } from 'vitest'
import { canAutoReload, isStaleBuildError, STALE_BUILD_RELOAD_WINDOW_MS } from '../lib/stale-build'

describe('发布新版本后旧分片失效的识别', () => {
  it('识别分片加载失败', () => {
    const error = Object.assign(new Error('Loading chunk 4821 failed.'), { name: 'ChunkLoadError' })
    expect(isStaleBuildError(error)).toBe(true)
  })
  it('识别动态导入失败', () => expect(isStaleBuildError(new Error('Failed to fetch dynamically imported module: /_next/static/chunks/app.js'))).toBe(true))
  it('识别 RSC 负载拉取失败', () => expect(isStaleBuildError(new Error('Failed to fetch RSC payload for /rentals'))).toBe(true))
  it('识别分片被回落成 HTML 的情况', () => expect(isStaleBuildError(new Error("Unexpected token '<'"))).toBe(true))
  it('识别 MIME 类型错误', () => expect(isStaleBuildError('Refused to execute script, strict MIME type checking is enabled and it is not a valid JavaScript MIME type')).toBe(true))
  it('识别嵌套在 cause 里的分片错误', () => expect(isStaleBuildError(new Error('渲染失败', { cause: new Error('Loading CSS chunk 12 failed') }))).toBe(true))
  it('不误判业务异常', () => {
    expect(isStaleBuildError(new Error('结束日期不能早于开始日期'))).toBe(false)
    expect(isStaleBuildError(new Error('未登录'))).toBe(false)
    expect(isStaleBuildError(null)).toBe(false)
    expect(isStaleBuildError(undefined)).toBe(false)
  })
  it('避免循环引用导致的死递归', () => {
    const error: Record<string, unknown> = { message: '未知错误' }
    error.cause = error
    expect(isStaleBuildError(error)).toBe(false)
  })
})

describe('自动刷新的防抖保护', () => {
  const now = 1_700_000_000_000
  it('首次遇到失效构建允许刷新', () => expect(canAutoReload(now, null)).toBe(true))
  it('窗口期内不重复刷新，避免无限重载', () => expect(canAutoReload(now, String(now - 1_000))).toBe(false))
  it('超过窗口期后允许再次刷新', () => expect(canAutoReload(now, String(now - STALE_BUILD_RELOAD_WINDOW_MS - 1))).toBe(true))
  it('存储值损坏时按首次处理', () => {
    expect(canAutoReload(now, 'abc')).toBe(true)
    expect(canAutoReload(now, '0')).toBe(true)
  })
})
