import { describe, expect, it } from 'vitest'
import { fullReturnWaiver, monthlyRentPeriod, overdueRentPeriods, recomputeUnpaidRentBills, remainingQuantityAsOf, returnBillingAdjustment } from '../lib/overdue-rent'

describe('逾期月租周期', () => {
  it('合同到期次日进入首期，并补齐到今天所在账期', () => {
    expect(overdueRentPeriods('2026-06-17', '2026-06-17')).toEqual([])
    expect(overdueRentPeriods('2026-06-17', '2026-06-18')).toEqual([
      { periodStart: '2026-06-18', periodEnd: '2026-07-18' },
    ])
    expect(overdueRentPeriods('2026-06-17', '2026-08-24')).toEqual([
      { periodStart: '2026-06-18', periodEnd: '2026-07-18' },
      { periodStart: '2026-07-18', periodEnd: '2026-08-18' },
      { periodStart: '2026-08-18', periodEnd: '2026-09-18' },
    ])
  })

  it('月末到期从次日即下月一日连续计费', () => {
    expect(overdueRentPeriods('2026-01-31', '2026-03-01')).toEqual([
      { periodStart: '2026-02-01', periodEnd: '2026-03-01' },
      { periodStart: '2026-03-01', periodEnd: '2026-04-01' },
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
    const base = { periodStart: '2026-06-01', periodEnd: '2026-07-01', returnDate: '2026-06-05', monthlyRent: '300.00', quantity: 1 }
    expect(returnBillingAdjustment({ ...base, mode: 'full_month' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 30000, adjustmentCents: 0, usedDays: 4 })
    expect(returnBillingAdjustment({ ...base, mode: 'daily' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 4000, adjustmentCents: 26000, usedDays: 4 })
    expect(returnBillingAdjustment({ ...base, mode: 'waive' })).toEqual({ fullAmountCents: 30000, chargedAmountCents: 0, adjustmentCents: 30000, usedDays: 4 })
  })

  it('多台设备按分计算并限制按天金额不超过整月', () => {
    expect(returnBillingAdjustment({ periodStart: '2026-06-01', periodEnd: '2026-07-01', returnDate: '2026-06-30', monthlyRent: '199.99', quantity: 2, mode: 'daily' })).toEqual({ fullAmountCents: 39998, chargedAmountCents: 38665, adjustmentCents: 1333, usedDays: 29 })
  })

  it('未来账单按剩余设备数量重算：必须叠加历史处置，否则第二次处置会漏算第一次', () => {
    const items = [{ id: 10, quantity: 8, monthlyRent: '120.00' }]
    const bills = [
      { id: 1, billType: '逾期续租租金', amount: '960.00', paidAmount: '0', periodStart: '2026-07-18' },
      { id: 2, billType: '逾期续租租金', amount: '960.00', paidAmount: '0', periodStart: '2026-08-18' },
    ]
    // 第一次退 2 台（历史记录）
    const afterFirstReturn = recomputeUnpaidRentBills(items, bills, [{ rentalItemId: 10, quantity: 2, date: '2026-06-12' }], '2026-06-12')
    expect(afterFirstReturn.map((r) => r.nextAmountCents)).toEqual([72000, 72000])

    // 第二次再退 1 台：disposals 必须包含第一次的历史记录 + 本次记录，否则会把剩余台数错算成 8-1=7 台
    const historicalPlusCurrent = [
      { rentalItemId: 10, quantity: 2, date: '2026-06-12' },
      { rentalItemId: 10, quantity: 1, date: '2026-07-20' },
    ]
    const afterSecondReturn = recomputeUnpaidRentBills(items, bills, historicalPlusCurrent, '2026-07-20')
    // 剩余 8-2-1=5 台，只有账期开始日 >= 2026-07-20 的账单（即第 2 张）会被重算
    expect(afterSecondReturn).toHaveLength(1)
    expect(afterSecondReturn[0].bill.id).toBe(2)
    expect(afterSecondReturn[0].nextAmountCents).toBe(60000)
    expect(afterSecondReturn[0].reductionCents).toBe(36000)
  })

  it('已收款或金额未变化的账单不会被重算函数触碰', () => {
    const items = [{ id: 10, quantity: 8, monthlyRent: '120.00' }]
    const bills = [
      { id: 1, billType: '逾期续租租金', amount: '720.00', paidAmount: '720.00', periodStart: '2026-07-18' },
      { id: 2, billType: '押金', amount: '500.00', paidAmount: '0', periodStart: '2026-07-18' },
      { id: 3, billType: '逾期续租租金', amount: '720.00', paidAmount: '0', periodStart: '2026-07-18' },
    ]
    const disposals = [{ rentalItemId: 10, quantity: 2, date: '2026-06-12' }]
    const result = recomputeUnpaidRentBills(items, bills, disposals, '2026-06-12')
    expect(result).toHaveLength(0)
  })

  it('全部退租且本期不收会取消当前及未来所有未收租金', () => {
    const result = fullReturnWaiver([
      { id: 1, billType: '起租预收', amount: '220.00', paidAmount: '0' },
      { id: 2, billType: '续租租金', amount: '220.00', paidAmount: '0' },
      { id: 3, billType: '押金', amount: '500.00', paidAmount: '0' },
      { id: 4, billType: '租金', amount: '220.00', paidAmount: '100.00' },
      { id: 5, billType: '租金', amount: '220.00', paidAmount: '220.00' },
    ])
    expect(result.adjustmentCents).toBe(56000)
    expect(result.affected.map((bill) => bill.id)).toEqual([1, 2, 4])
  })
})
