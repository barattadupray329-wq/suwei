import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const accessSource = readFileSync('lib/access.ts', 'utf8')
const dashboardPage = readFileSync('app/dashboard/page.tsx', 'utf8')
const dashboardAction = readFileSync('app/actions/rentals.ts', 'utf8')
const invalidPathPage = readFileSync('app/[...invalidPath]/page.tsx', 'utf8')
const notFoundPage = readFileSync('app/not-found.tsx', 'utf8')
const migration = readFileSync('migrations/d1/0014_concurrency_performance.sql', 'utf8')

describe('多用户并发与错误网址恢复', () => {
  it('在单次服务端请求内复用访问上下文', () => {
    expect(accessSource).toContain("import { cache } from 'react'")
    expect(accessSource).toContain('const resolveAccessContext = cache(async () =>')
    expect(dashboardPage).not.toContain('auth.api.getSession')
  })

  it('经营总览使用一次合同聚合并保留租户过滤', () => {
    expect(dashboardAction).toContain("draft: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'draft'")
    expect(dashboardAction).toContain('eq(rentals.userId, userId)')
    expect(dashboardAction).not.toContain('draftSummary?.draft')
  })

  it('只修复字面量通配符地址并保留正常 404', () => {
    expect(invalidPathPage).toContain("literalPath === ':path*'")
    expect(invalidPathPage).toContain("redirect('/dashboard')")
    expect(invalidPathPage).toContain('notFound()')
    expect(notFoundPage).toContain('返回经营总览')
  })

  it('为并发高频查询提供幂等索引', () => {
    expect(migration).toContain('IF NOT EXISTS')
    expect(migration).toContain('rentals_dashboard_idx')
    expect(migration).toContain('rental_items_device_summary_idx')
    expect(migration).toContain('session_user_expires_idx')
  })
})
