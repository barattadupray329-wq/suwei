import { describe, expect, it } from 'vitest'
import { priceAtPeriod, priceChangeImpact, setPriceNode } from '../lib/rental-price-periods'

describe('rental price periods', () => {
  it('continues a changed price until the next node', () => {
    const mayChange = setPriceNode({ periods: [], startPeriod: 5, unitPrice: '80', fallback: '100', lastPeriod: 12 })
    expect(priceAtPeriod(mayChange, 4, '100')).toBe('100')
    expect(priceAtPeriod(mayChange, 5, '100')).toBe('80.00')
    expect(priceAtPeriod(mayChange, 7, '100')).toBe('80.00')

    const augustChange = setPriceNode({ periods: mayChange, startPeriod: 8, unitPrice: '70', fallback: '100', lastPeriod: 12 })
    expect(priceAtPeriod(augustChange, 7, '100')).toBe('80.00')
    expect(priceAtPeriod(augustChange, 8, '100')).toBe('70.00')
    expect(priceAtPeriod(augustChange, 12, '100')).toBe('70.00')
  })

  it('replaces an existing node without overlapping ranges', () => {
    const periods = setPriceNode({
      periods: [
        { startPeriod: 1, endPeriod: 4, unitPrice: '100' },
        { startPeriod: 5, endPeriod: 12, unitPrice: '80' },
      ],
      startPeriod: 5,
      unitPrice: '75',
      fallback: '100',
      lastPeriod: 12,
    })
    expect(periods).toEqual([
      { startPeriod: 1, endPeriod: 4, unitPrice: '100' },
      { startPeriod: 5, endPeriod: 12, unitPrice: '75.00' },
    ])
  })

  it('merges adjacent nodes with the same price', () => {
    const periods = setPriceNode({
      periods: [{ startPeriod: 1, endPeriod: 7, unitPrice: '100' }, { startPeriod: 8, endPeriod: 12, unitPrice: '70' }],
      startPeriod: 8,
      unitPrice: '100',
      fallback: '100',
      lastPeriod: 12,
    })
    expect(periods).toEqual([{ startPeriod: 1, endPeriod: 12, unitPrice: '100' }])
  })

  it('calculates the impact for quantity and affected periods', () => {
    expect(priceChangeImpact({ oldUnitPrice: '100', newUnitPrice: '80', quantity: 2, periods: 3 })).toEqual({ differenceCents: -12000, difference: '-120.00' })
  })
})
