import { describe, expect, it } from 'vitest'
import { availableQuantity, rentalLifecycleStatus } from '../lib/rental-lifecycle'

const item = (overrides: Partial<Parameters<typeof availableQuantity>[0]> = {}) => ({
  quantity: 5,
  boughtOutQuantity: 0,
  returnedQuantity: 0,
  lostQuantity: 0,
  ...overrides,
})

describe('租赁生命周期规则', () => {
  it('统一扣除买断、退租和丢失数量', () => {
    expect(availableQuantity(item({ boughtOutQuantity: 1, returnedQuantity: 2, lostQuantity: 1 }))).toBe(1)
  })

  it('可用数量不会变成负数', () => {
    expect(availableQuantity(item({ boughtOutQuantity: 3, returnedQuantity: 3 }))).toBe(0)
  })

  it.each([
    [[item()], '在租'],
    [[item({ returnedQuantity: 1 })], '部分退租'],
    [[item({ lostQuantity: 1 })], '部分丢失'],
    [[item({ boughtOutQuantity: 1 })], '部分买断'],
    [[item({ returnedQuantity: 5 })], '已退租'],
    [[item({ boughtOutQuantity: 5 })], '买断'],
    [[item({ returnedQuantity: 4, lostQuantity: 1 })], '已结束'],
  ])('根据设备处置数量得到合同状态', (items, expected) => {
    expect(rentalLifecycleStatus(items)).toBe(expected)
  })
})
