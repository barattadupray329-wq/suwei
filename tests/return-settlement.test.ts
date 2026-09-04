import { describe, expect, test } from 'vitest'
import { fullReturnWaiver, isRentBillType, returnBillingAdjustment } from '../lib/overdue-rent'
import { calculateReturnRent } from '../lib/return-settlement'

const base = { periodStart: '2026-08-01', periodEnd: '2026-09-01', returnDate: '2026-08-10', fullAmount: 300 }

describe('退租租金结算', () => {
  test('整期收取不退款，未收齐时显示应补', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 100, mode: 'full_month' })).toMatchObject({ usedDays: 9, remainingDays: 22, collectAmount: 0, refundAmount: 0, chargeAmount: 100 })
  })

  test('3月18日租三个月，6月14日退租按5月18日至6月18日本期计算', () => {
    expect(calculateReturnRent({ periodStart: '2026-05-18', periodEnd: '2026-06-18', returnDate: '2026-06-14', fullAmount: 240, collectedAmount: 0, mode: 'full_month' })).toMatchObject({ usedDays: 27, remainingDays: 4, collectAmount: 0, refundAmount: 0, chargeAmount: 0 })
    expect(calculateReturnRent({ periodStart: '2026-05-18', periodEnd: '2026-06-18', returnDate: '2026-06-14', fullAmount: 240, collectedAmount: 240, mode: 'daily' })).toMatchObject({ usedDays: 27, remainingDays: 4, chargeAmount: 216, refundAmount: 24 })
  })

  test('退剩余天数固定按30天折算且退款不超过实收', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 300, mode: 'daily' })).toMatchObject({ usedDays: 9, remainingDays: 22, chargeAmount: 90, refundAmount: 210, dailyAmount: 10 })
    expect(calculateReturnRent({ ...base, collectedAmount: 50, mode: 'daily' }).refundAmount).toBe(0)
  })

  test('退本期全额只退本期实收', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 180, mode: 'waive' })).toMatchObject({ chargeAmount: 0, refundAmount: 180, collectAmount: 0 })
  })

  test('退租日超出账期时剩余天数不为负数', () => {
    expect(calculateReturnRent({ ...base, returnDate: '2026-09-10', collectedAmount: 300, mode: 'daily' })).toMatchObject({ usedDays: 30, remainingDays: 0, refundAmount: 0 })
  })

  test('退4台留1台选择本期全额减免时，仅减免4台的440元，剩余1台仍应收110元', () => {
    const adjustment = returnBillingAdjustment({
      periodStart: '2026-09-02',
      periodEnd: '2026-10-02',
      returnDate: '2026-09-04',
      monthlyRent: '110.00',
      quantity: 4,
      mode: 'waive',
    })
    expect(adjustment.fullAmountCents).toBe(44000)
    expect(adjustment.chargedAmountCents).toBe(0)
    expect(adjustment.adjustmentCents).toBe(44000)
    expect(110 * 100).toBe(55000 - adjustment.adjustmentCents)
  })

  test('全部退租免租时续租费也纳入取消范围', () => {
    expect(isRentBillType('续租费')).toBe(true)
    const waiver = fullReturnWaiver([
      { id: 1, billType: '续租费', amount: '600.00', paidAmount: '0' },
      { id: 2, billType: '续租费', amount: '600.00', paidAmount: '0' },
      { id: 3, billType: '续租费', amount: '600.00', paidAmount: '0' },
      { id: 4, billType: '丢失赔偿', amount: '900.00', paidAmount: '0' },
    ])
    expect(waiver.affected.map((bill) => bill.id)).toEqual([1, 2, 3])
    expect(waiver.adjustmentCents).toBe(180000)
  })
})
