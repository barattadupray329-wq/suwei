import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actions = readFileSync('app/actions/rentals.ts', 'utf8')
const dashboard = readFileSync('components/dashboard.tsx', 'utf8')

describe('正式合同创建后的刷新范围', () => {
  it('只刷新业务页面，不重新验证公开首页', () => {
    expect(actions).toContain("revalidatePath('/rentals')")
    expect(actions).toContain("revalidatePath('/dashboard')")
  })

  it('创建成功后移除 new 参数并返回租赁列表', () => {
    expect(dashboard).toContain('router.replace("/rentals")')
  })
})
