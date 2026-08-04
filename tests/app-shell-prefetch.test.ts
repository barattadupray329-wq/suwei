import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'components/app-shell.tsx'), 'utf8')

describe('后台导航资源策略', () => {
  it('所有 AppShell Link 均关闭自动预取，避免 Worker 冷启动请求风暴', () => {
    const links = [...source.matchAll(/<Link\b[\s\S]*?>/g)].map((match) => match[0])

    expect(links.length).toBeGreaterThanOrEqual(3)
    expect(links.every((link) => link.includes('prefetch={false}'))).toBe(true)
  })
})
