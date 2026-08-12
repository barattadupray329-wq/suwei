import { describe, expect, it } from 'vitest'
import { adjustablePeriodLimit, billingPeriod, billingPeriodAt, billingPeriodFromBills, billingPeriodOptions, billingPeriodsFromBills, effectiveBillingPeriod, isBillingPeriodLocked, periodNumberAt } from '../lib/billing-periods'

describe('billing periods', () => {
  it('shows the fifth through the fourth as one calendar month', () => {
    expect(billingPeriod('2026-06-05', 1)).toEqual({ periodNo: 1, start: '2026-06-05', endExclusive: '2026-07-05', displayEnd: '2026-07-04' })
    expect(billingPeriod('2026-06-05', 3)).toEqual({ periodNo: 3, start: '2026-08-05', endExclusive: '2026-09-05', displayEnd: '2026-09-04' })
  })

  it('keeps month-end anchors on valid month-end dates', () => {
    expect(billingPeriod('2026-01-31', 1).displayEnd).toBe('2026-02-27')
    expect(billingPeriod('2026-01-31', 2).start).toBe('2026-02-28')
  })

  it('locates the return date period without requiring an existing bill', () => {
    expect(billingPeriodAt('2026-03-28', '2026-06-18')).toEqual({ periodNo: 3, start: '2026-05-28', endExclusive: '2026-06-28', displayEnd: '2026-06-27' })
    expect(billingPeriodAt('2026-03-28', '2026-06-28').periodNo).toBe(4)
  })

  it('only accepts exact period boundaries', () => {
    expect(periodNumberAt('2026-06-01', '2026-09-01')).toBe(4)
    expect(() => periodNumberAt('2026-06-01', '2026-09-02')).toThrow('不是')
  })

  it('starts price changes from the next period when operated mid-period', () => {
    expect(effectiveBillingPeriod('2026-07-01', '2026-07-29').start).toBe('2026-08-01')
    expect(effectiveBillingPeriod('2026-07-01', '2026-08-01').start).toBe('2026-08-01')
  })

  it('creates options from each item own billing anchor', () => {
    expect(billingPeriodOptions({ anchorDate: '2026-05-22', operationDate: '2026-07-29', endDate: '2026-10-22' }).map((period) => period.start)).toEqual([
      '2026-08-22',
      '2026-09-22',
      '2026-10-22',
    ])
  })

  it('allows the current and next period after the original contract end', () => {
    expect(adjustablePeriodLimit('2026-05-07', '2026-08-12')).toBe(5)
    expect(adjustablePeriodLimit('2022-06-01', '2026-08-12')).toBe(52)
  })

  it('also keeps a later generated bill visible for adjustment', () => {
    expect(adjustablePeriodLimit('2026-05-07', '2026-08-12', ['2026-10-07'])).toBe(6)
  })

  it('uses an actual single-period bill instead of rebuilding the fifth period from the contract anchor', () => {
    const bills = [
      { id: 1, periodStart: '2026-05-07', periodEnd: '2026-07-06', dueDate: '2026-05-07' },
      { id: 2, periodStart: '2026-07-08', periodEnd: '2026-08-07', dueDate: '2026-07-08' },
      { id: 3, periodStart: '2026-08-07', periodEnd: '2026-09-07', dueDate: '2026-08-07' },
    ]

    expect(billingPeriodFromBills('2026-05-07', 5, bills)).toEqual({
      periodNo: 5,
      start: '2026-08-07',
      endExclusive: '2026-09-08',
      displayEnd: '2026-09-07',
    })
  })

  it('continues future periods from the last actual bill boundary', () => {
    const periods = billingPeriodsFromBills('2026-05-07', [
      { id: 1, periodStart: '2026-05-07', periodEnd: '2026-07-06' },
      { id: 2, periodStart: '2026-07-08', periodEnd: '2026-08-07' },
      { id: 3, periodStart: '2026-08-07', periodEnd: '2026-09-07' },
    ], 6)

    expect(periods[5]).toEqual({ periodNo: 6, start: '2026-09-08', endExclusive: '2026-10-08', displayEnd: '2026-10-07' })
  })

  it('does not lock an unpaid fifth period when an earlier paid bill overlaps its dates', () => {
    const bills = [
      { id: 1, periodStart: '2026-05-07', periodEnd: '2026-07-06', paidAmount: '1200', status: '已结清' },
      { id: 2, periodStart: '2026-07-08', periodEnd: '2026-08-07', paidAmount: '500', status: '已结清' },
      { id: 3, periodStart: '2026-08-07', periodEnd: '2026-09-07', paidAmount: '0', status: '逾期' },
    ]

    expect(isBillingPeriodLocked('2026-05-07', 4, bills)).toBe(true)
    expect(isBillingPeriodLocked('2026-05-07', 5, bills)).toBe(false)
  })
})
