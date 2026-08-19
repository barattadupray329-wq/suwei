import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actions = readFileSync('app/actions/rentals.ts', 'utf8')
const dashboard = readFileSync('components/dashboard.tsx', 'utf8')

describe('正式合同创建后的刷新范围', () => {
  it('创建动作失效租赁与经营总览缓存，确保待收金额立即更新', () => {
    const createOperation = actions.slice(actions.indexOf('async function createRentalOperation'), actions.indexOf('export async function createRental('))
    expect(createOperation).toContain("revalidatePath('/rentals')")
    expect(createOperation).toContain("revalidatePath('/dashboard')")
  })

  it('创建成功后移除 new 参数并返回租赁列表', () => {
    expect(dashboard).toContain('router.replace("/rentals")')
  })
})
