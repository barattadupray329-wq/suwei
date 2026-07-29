import { describe, expect, it } from 'vitest'
import { overdueRentPeriods, remainingQuantityAsOf } from '../lib/overdue-rent'

describe('逾期月租周期', () => {
  it('到期次日立即产生首期，之后按月累加', () => {
    expect(overdueRentPeriods('2026-04-01', '2026-04-02')).toEqual([
      { periodStart: '2026-04-02', periodEnd: '2026-05-02' },
    ])
    expect(overdueRentPeriods('2026-04-01', '2026-05-06')).toEqual([
      { periodStart: '2026-04-02', periodEnd: '2026-05-02' },
      { periodStart: '2026-05-02', periodEnd: '2026-06-02' },
    ])
  })

  it('月末周期使用目标月份最后一天', () => {
    expect(overdueRentPeriods('2026-01-30', '2026-03-01')).toEqual([
      { periodStart: '2026-01-31', periodEnd: '2026-02-28' },
      { periodStart: '2026-02-28', periodEnd: '2026-03-28' },
    ])
  })

  it('处置只影响处置日当天及之后开始的新账单', () => {
    const disposals = [{ rentalItemId: 10, quantity: 1, date: '2026-05-01' }]
    expect(remainingQuantityAsOf(2, 10, '2026-04-02', disposals)).toBe(2)
    expect(remainingQuantityAsOf(2, 10, '2026-05-02', disposals)).toBe(1)
  })
})
