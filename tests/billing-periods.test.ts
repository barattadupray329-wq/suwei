import { describe, expect, it } from 'vitest'
import { billingPeriod, periodNumberAt } from '@/lib/billing-periods'

describe('billing periods', () => {
  it('shows the fifth through the fourth as one calendar month', () => {
    expect(billingPeriod('2026-06-05', 1)).toEqual({ periodNo: 1, start: '2026-06-05', endExclusive: '2026-07-05', displayEnd: '2026-07-04' })
    expect(billingPeriod('2026-06-05', 3)).toEqual({ periodNo: 3, start: '2026-08-05', endExclusive: '2026-09-05', displayEnd: '2026-09-04' })
  })

  it('keeps month-end anchors on valid month-end dates', () => {
    expect(billingPeriod('2026-01-31', 1).displayEnd).toBe('2026-02-27')
    expect(billingPeriod('2026-01-31', 2).start).toBe('2026-02-28')
  })

  it('only accepts exact period boundaries', () => {
    expect(periodNumberAt('2026-06-01', '2026-09-01')).toBe(4)
    expect(() => periodNumberAt('2026-06-01', '2026-09-02')).toThrow('不是')
  })
})
