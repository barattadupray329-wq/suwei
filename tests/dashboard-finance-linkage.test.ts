import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const dashboard = readFileSync('components/dashboard.tsx', 'utf8')
const rentalActions = readFileSync('app/actions/rentals.ts', 'utf8')
const businessActions = readFileSync('app/actions/business.ts', 'utf8')
const financePage = readFileSync('app/finance/page.tsx', 'utf8')
const financeLedger = readFileSync('components/finance-ledger.tsx', 'utf8')
const rentalRecords = readFileSync('components/rental-records.tsx', 'utf8')

describe('经营总览金额与明细关联', () => {
  test('累计收款进入专用明细视图并使用付款记录汇总', () => {
    expect(dashboard).toContain('/finance?view=receipts')
    expect(dashboard).not.toContain('/finance?type=收款')
    expect(rentalActions).toContain('sum(cast(${paymentRecords.amount} as real))')
    expect(financePage).toContain("value('view') === 'receipts'")
    expect(businessActions).toContain("input.view === 'receipts'")
    expect(financeLedger).toContain('累计收款明细')
    expect(financeLedger).toContain('当前筛选')
  })

  test('待收总览与清单排除终止合同并显示可核对余额', () => {
    expect(rentalActions).toContain("'买断', '已买断', '已退租', '已退回', '已结束', '已关闭', '已完成', '丢失', '已丢失'")
    expect(rentalActions).toContain('const receivableTotal = matchingRentalRows.reduce')
    expect(rentalRecords).toContain('待收合计')
    expect(rentalRecords).toContain('合同 {money(row.totalRent)}')
    expect(rentalRecords).toContain('待收 {money(String(Math.max(Number(row.totalRent) - Number(row.paidAmount), 0)))}')
  })
})
