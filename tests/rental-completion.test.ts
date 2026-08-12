import { describe, expect, it } from 'vitest'
import { isSettledReturnedRental } from '../lib/rental-completion'

describe('已结清退回统一判定', () => {
  it('已退租、无待收且无剩余设备时标记完结', () => {
    expect(isSettledReturnedRental({ status: '已退租', outstandingCents: 0, remainingDevices: 0 })).toBe(true)
  })

  it.each([
    { status: '在租', outstandingCents: 0, remainingDevices: 0 },
    { status: '已退租', outstandingCents: 55_000, remainingDevices: 0 },
    { status: '已退租', outstandingCents: 0, remainingDevices: 1 },
  ])('状态、账务或设备未完结时不盖章', (input) => {
    expect(isSettledReturnedRental(input)).toBe(false)
  })
})
