import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const actionSource = readFileSync(new URL('../app/actions/rentals.ts', import.meta.url), 'utf8')
const recordsSource = readFileSync(new URL('../components/rental-records.tsx', import.meta.url), 'utf8')

describe('租赁列表业务优先级排序', () => {
  test('通过明细剩余数量和终态状态识别结束合同', () => {
    expect(actionSource).toMatch(/sum\(max\(ri\.quantity - ri\."boughtOutQuantity" - ri\."returnedQuantity" - ri\."lostQuantity", 0\)\)/)
    expect(actionSource).toMatch(/or \$\{remainingQuantity\} <= 0 then 1 else 0/)
  })

  test('默认先按结束标记沉底，再按到期日排序', () => {
    expect(actionSource).toMatch(/\[finishedPriority, asc\(rentals\.endDate\), desc\(rentals\.createdAt\)\]/)
    expect(actionSource).toMatch(/orderBy\(\.\.\.selectedOrder, desc\(rentals\.id\)\)\.limit\(value\.pageSize\)\.offset\(offset\)/)
  })

  test('手动排序同样保持结束合同沉底', () => {
    expect(actionSource).toMatch(/\[finishedPriority, asc\(rentals\.createdAt\)\]/)
    expect(actionSource).toMatch(/\[finishedPriority, desc\(sql`cast\(\$\{rentals\.totalRent\} as real\)`\)\]/)
  })

  test('界面明确标注默认按到期优先', () => {
    expect(recordsSource).toContain('<option value="newest">到期优先</option>')
  })
})
