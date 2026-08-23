import { describe, expect, it } from 'vitest'
import { billsAfterReturnDate, effectiveRentBillTotalCents, fullReturnWaiver, hasEffectivePaymentAfterDate, monthlyRentPeriod, overdueRentPeriods, remainingQuantityAsOf, returnBillingAdjustment } from '../lib/overdue-rent'

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

  it('历史退租只关闭退租日覆盖的账期及之后账单', () => {
    const bills = [
      { id: 1, billType: '租金', periodStart: '2026-03-18', periodEnd: '2026-04-18', amount: '600.00', paidAmount: '0', status: '待收' },
      { id: 2, billType: '续租费', periodStart: '2026-04-18', periodEnd: '2026-05-18', amount: '600.00', paidAmount: '0', status: '待收' },
      { id: 3, billType: '押金', periodStart: '2026-03-18', periodEnd: '2026-03-18', amount: '4000.00', paidAmount: '0', status: '待收' },
    ]
    expect(billsAfterReturnDate(bills, '2026-03-18').map((bill) => bill.id)).toEqual([1, 2])
    expect(effectiveRentBillTotalCents(bills)).toBe(120000)
  })

  it('历史退租日之后存在未冲正正数收款时必须阻止', () => {
    const payments = [
      { id: 10, paymentDate: '2026-03-18', amount: '600.00' },
      { id: 11, paymentDate: '2026-04-18', amount: '600.00' },
    ]
    expect(hasEffectivePaymentAfterDate(payments, new Set<number>(), '2026-03-18')).toBe(true)
    expect(hasEffectivePaymentAfterDate(payments, new Set([11]), '2026-03-18')).toBe(false)
  })
})
