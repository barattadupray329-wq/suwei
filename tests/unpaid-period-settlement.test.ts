import { describe, expect, it } from 'vitest'
import { planUnpaidPeriodSettlement } from '../lib/return-settlement'

const bills = [
  { id: 1, periodStart: '2026-08-12', periodEnd: '2026-09-12', amountCents: 54000, paidCents: 0 },
  { id: 2, periodStart: '2026-09-12', periodEnd: '2026-10-12', amountCents: 54000, paidCents: 0 },
]

describe('planUnpaidPeriodSettlement', () => {
  it('waives only the returned devices share of the checked periods', () => {
    const plan = planUnpaidPeriodSettlement({ bills: [bills[1]], returnedMonthlyCents: 18000, returnDate: '2026-09-16', mode: 'waive' })
    expect(plan.totalShareCents).toBe(18000)
    expect(plan.totalReductionCents).toBe(18000)
    expect(plan.totalChargeCents).toBe(0)
  })

  it('charges used days and waives the remaining days', () => {
    const plan = planUnpaidPeriodSettlement({ bills: [bills[1]], returnedMonthlyCents: 18000, returnDate: '2026-09-16', mode: 'daily' })
    expect(plan.rows[0].usedDays).toBe(4)
    expect(plan.totalChargeCents).toBe(2400)
    expect(plan.totalReductionCents).toBe(15600)
  })

  it('allocates an agreed total from the earliest period first', () => {
    const plan = planUnpaidPeriodSettlement({ bills: [bills[1], bills[0]], returnedMonthlyCents: 18000, returnDate: '2026-09-16', mode: 'amount', amountCents: 20000 })
    expect(plan.rows.map((row) => row.chargeCents)).toEqual([18000, 2000])
    expect(plan.totalReductionCents).toBe(16000)
    expect(plan.amountExceedsShare).toBe(false)
  })

  it('never reduces more than the unpaid part and flags oversized totals', () => {
    const partlyPaid = { ...bills[1], paidCents: 50000 }
    expect(planUnpaidPeriodSettlement({ bills: [partlyPaid], returnedMonthlyCents: 18000, returnDate: '2026-09-16', mode: 'waive' }).totalReductionCents).toBe(4000)
    expect(planUnpaidPeriodSettlement({ bills: [bills[1]], returnedMonthlyCents: 18000, returnDate: '2026-09-16', mode: 'amount', amountCents: 20000 }).amountExceedsShare).toBe(true)
  })
})
