import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actions = readFileSync('app/actions/rentals.ts', 'utf8')
const dashboard = readFileSync('components/dashboard.tsx', 'utf8')

describe('正式合同创建后的刷新范围', () => {
  it('创建动作不主动刷新当前 RSC，避免与成功导航重复渲染', () => {
    const createOperation = actions.slice(actions.indexOf('async function createRentalOperation'), actions.indexOf('export async function createRental('))
    expect(createOperation).not.toContain("revalidatePath('/rentals')")
    expect(createOperation).not.toContain("revalidatePath('/dashboard')")
  })

  it('创建成功后移除 new 参数并返回租赁列表', () => {
    expect(dashboard).toContain('router.replace("/rentals")')
  })
})
