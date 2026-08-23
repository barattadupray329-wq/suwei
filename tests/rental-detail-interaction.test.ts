import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const root = process.cwd()
const dashboard = readFileSync(join(root, 'components/dashboard.tsx'), 'utf8')
const records = readFileSync(join(root, 'components/rental-records.tsx'), 'utf8')
const rentalActions = readFileSync(join(root, 'app/actions/rentals.ts'), 'utf8')

test('带 rental 参数关闭详情时返回原列表查询上下文', () => {
  expect(dashboard).toMatch(
    /if \(searchParams\.has\("rental"\)\) \{\s*window\.location\.assign\(returnHref\);\s*return;/,
  )
  expect(records).toMatch(/params\.set\('rental', String\(id\)\)/)
  expect(dashboard).not.toMatch(/router\.push\(returnHref\)/)
})

test('详情子流程成功后回到同一合同详情', () => {
  expect(dashboard).toMatch(/runInDetail\(\(\) => collectPayment\(selected\.id, value\), "收款已登记"\)/)
  expect(dashboard).toMatch(/setDialog\(successDialog\);\s*router\.refresh\(\)/)
})

test('合同详情首次打开主动刷新且不会循环刷新', () => {
  expect(dashboard).toContain('const detailRefreshStarted = useRef(false)')
  expect(dashboard).toMatch(/if \(!linkedRental \|\| detailRefreshStarted\.current\) return;\s*detailRefreshStarted\.current = true;\s*router\.refresh\(\)/)
})

test('租赁管理桌面合同列表双击打开详情', () => {
  expect(dashboard).toMatch(/onDoubleClick=\{\(\) => openDetail\(r\)\}/)
  expect(records).toMatch(/onDoubleClick=\{\(\) => openDetail\(row\.id\)\}/)
})

test('多月续租按月创建独立账单并逐月分配即时收款', () => {
  expect(rentalActions).toContain('for (let periodIndex = 0; periodIndex < value.duration; periodIndex += 1)')
  expect(rentalActions).toContain('billNo: `RENEW-${rentalId}-${renewal.id}-${periodIndex + 1}`')
  expect(rentalActions).toContain('paymentAllocations).values(renewalBills.map')
  expect(rentalActions).not.toContain("periodStart: renewalPeriodStart, periodEnd: newEndDate")
})
