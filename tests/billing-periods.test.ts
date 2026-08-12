import { describe, expect, it } from 'vitest'
import { adjustablePeriodLimit, billingPeriod, billingPeriodAt, billingPeriodOptions, effectiveBillingPeriod, periodNumberAt } from '../lib/billing-periods'

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
})
