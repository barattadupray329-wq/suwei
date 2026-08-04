import { describe, expect, test } from 'vitest'
import { calculateReturnRent } from '../lib/return-settlement'
import { recalculateBillsAfterReturn } from '../lib/overdue-rent'

const base = { periodStart: '2026-08-01', periodEnd: '2026-09-01', returnDate: '2026-08-10', fullAmount: 300 }

describe('退租租金结算', () => {
  test('整期收取不退款，未收齐时显示应补', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 100, mode: 'full_month' })).toMatchObject({ usedDays: 10, remainingDays: 20, collectAmount: 200, refundAmount: 0 })
  })

  test('退剩余天数固定按30天折算且退款不超过实收', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 300, mode: 'daily' })).toMatchObject({ usedDays: 10, remainingDays: 20, chargeAmount: 100, refundAmount: 200, dailyAmount: 10 })
    expect(calculateReturnRent({ ...base, collectedAmount: 50, mode: 'daily' }).refundAmount).toBe(0)
  })

  test('退本期全额只退本期实收', () => {
    expect(calculateReturnRent({ ...base, collectedAmount: 180, mode: 'waive' })).toMatchObject({ chargeAmount: 0, refundAmount: 180, collectAmount: 0 })
  })

  test('退租日超出账期时剩余天数不为负数', () => {
    expect(calculateReturnRent({ ...base, returnDate: '2026-09-10', collectedAmount: 300, mode: 'daily' })).toMatchObject({ usedDays: 30, remainingDays: 0, refundAmount: 0 })
  })

  test('退租后的每一期都按剩余设备数量直接重算', () => {
    const bills = [
      { id: 4, periodStart: '2026-06-01', periodEnd: '2026-07-02', amount: '420', paidAmount: '420', billType: '租金' },
      { id: 5, periodStart: '2026-07-01', periodEnd: '2026-08-02', amount: '420', paidAmount: '0', billType: '租金' },
      { id: 6, periodStart: '2026-08-01', periodEnd: '2026-09-02', amount: '420', paidAmount: '0', billType: '租金' },
    ]

    expect(recalculateBillsAfterReturn({ bills, monthlyRent: '140', returnedQuantity: 2, returnDate: '2026-06-30' })).toEqual([
      { id: 5, previousAmountCents: 42000, nextAmountCents: 14000, reductionCents: 28000 },
      { id: 6, previousAmountCents: 42000, nextAmountCents: 14000, reductionCents: 28000 },
    ])
  })

  test('重算账单不会把应收调低到已收金额以下', () => {
    const bills = [{ id: 5, periodStart: '2026-07-01', periodEnd: '2026-08-02', amount: '420', paidAmount: '200', billType: '租金' }]
    expect(recalculateBillsAfterReturn({ bills, monthlyRent: '140', returnedQuantity: 2, returnDate: '2026-06-30' })[0]).toMatchObject({ nextAmountCents: 20000, reductionCents: 22000 })
  })
})
