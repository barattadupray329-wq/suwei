import { describe, expect, it } from 'vitest'
import { monthlyRentPeriod, overdueRentPeriods, remainingQuantityAsOf, returnBillingAdjustment } from '../lib/overdue-rent'

describe('逾期月租周期', () => {
  it('到期日立即进入首期，周期开始日当天不重复生成下一期', () => {
    expect(overdueRentPeriods('2026-06-01', '2026-06-01')).toEqual([])
    expect(overdueRentPeriods('2026-06-01', '2026-06-05')).toEqual([
      { periodStart: '2026-06-01', periodEnd: '2026-07-01' },
    ])
    expect(overdueRentPeriods('2026-06-01', '2026-08-01')).toEqual([
      { periodStart: '2026-06-01', periodEnd: '2026-07-01' },
      { periodStart: '2026-07-01', periodEnd: '2026-08-01' },
    ])
  })

  it('月末周期使用目标月份最后一天', () => {
    expect(overdueRentPeriods('2026-01-31', '2026-03-01')).toEqual([
      { periodStart: '2026-01-31', periodEnd: '2026-02-28' },
      { periodStart: '2026-02-28', periodEnd: '2026-03-28' },
    ])
  })

  it('合同期内退租能定位当前月租账期', () => {
    expect(monthlyRentPeriod('2026-08-15', '2026-10-14', '2026-08-15')).toEqual({
      periodStart: '2026-08-15',
      periodEnd: '2026-09-15',
    })
    expect(monthlyRentPeriod('2026-08-15', '2026-10-14', '2026-09-20')).toEqual({
      periodStart: '2026-09-15',
      periodEnd: '2026-10-15',
    })
  })

  it('处置只影响处置日当天及之后开始的新账单', () => {
    const disposals = [{ rentalItemId: 10, quantity: 1, date: '2026-06-05' }]
    expect(remainingQuantityAsOf(2, 10, '2026-06-01', disposals)).toBe(2)
    expect(remainingQuantityAsOf(2, 10, '2026-07-01', disposals)).toBe(1)
  })

  it('退租默认整月收取，按天使用月租除以 30，本期不收则全额调整', () => {
    const base = { periodStart: '2026-06-01', returnDate: '2026-06-05', monthlyRent: '300.00', quantity: 1 }
    expect(returnBillingAdjustment({ ...base, mode: 'full_month' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 30000, adjustmentCents: 0, usedDays: 5 })
    expect(returnBillingAdjustment({ ...base, mode: 'daily' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 5000, adjustmentCents: 25000, usedDays: 5 })
    expect(returnBillingAdjustment({ ...base, mode: 'waive' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 0, adjustmentCents: 30000, usedDays: 5 })
  })

  it('多台设备按分计算并限制按天金额不超过整月', () => {
    expect(returnBillingAdjustment({ periodStart: '2026-06-01', returnDate: '2026-06-30', monthlyRent: '199.99', quantity: 2, mode: 'daily' })).toEqual({ fullAmountCents: 39998, chargedAmountCents: 39998, adjustmentCents: 0, usedDays: 30 })
  })
})
