import { describe, expect, it } from 'vitest'
import { getRentalCompletion, isSettledReturnedRental } from '../lib/rental-completion'

describe('订单完成章统一判定', () => {
  it('全部设备买断且账务结清时显示买断完成', () => {
    expect(getRentalCompletion({ outstandingCents: 0, totalDevices: 2, remainingDevices: 0, returnedDevices: 0, boughtOutDevices: 2 })).toMatchObject({ kind: 'buyout', label: '买断完成' })
  })

  it('全部设备退回且账务结清时显示退回完成', () => {
    expect(getRentalCompletion({ outstandingCents: 0, totalDevices: 3, remainingDevices: 0, returnedDevices: 3, boughtOutDevices: 0 })).toMatchObject({ kind: 'returned', label: '退回完成' })
  })

  it('买断和退回共同完结时显示订单完成及处置方式', () => {
    expect(getRentalCompletion({ outstandingCents: 0, totalDevices: 3, remainingDevices: 0, returnedDevices: 1, boughtOutDevices: 2 })).toEqual({ kind: 'mixed', label: '订单完成', detail: '买断 + 退回' })
  })

  it.each([
    { outstandingCents: 24_000, totalDevices: 2, remainingDevices: 0, returnedDevices: 0, boughtOutDevices: 2 },
    { outstandingCents: 0, totalDevices: 5, remainingDevices: 5, returnedDevices: 0, boughtOutDevices: 0 },
  ])('有待收或仍有在租设备时不盖完成章', (input) => {
    expect(getRentalCompletion(input)).toBeNull()
  })

  it('兼容已结束的历史退回合同判定', () => {
    expect(isSettledReturnedRental({ status: '已结束', outstandingCents: 0, remainingDevices: 0 })).toBe(true)
  })
})
