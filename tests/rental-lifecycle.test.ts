import { describe, expect, it } from 'vitest'
import { availableQuantity, rentalDeviceSummary, rentalLifecycleStatus } from '../lib/rental-lifecycle'

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

  it('处置数量超过原数量时拒绝继续计算', () => {
    expect(() => availableQuantity(item({ boughtOutQuantity: 3, returnedQuantity: 3 }))).toThrow('已退、已买断和已丢失数量之和不能超过原数量')
  })

  it('按类型汇总有效在租设备并将台式机显示为主机', () => {
    expect(rentalDeviceSummary([
      { ...item({ quantity: 3, returnedQuantity: 1 }), deviceType: '台式机' },
      { ...item({ quantity: 1 }), deviceType: '台式机' },
      { ...item({ quantity: 3, lostQuantity: 1 }), deviceType: '显示器' },
    ])).toEqual([
      { label: '主机', quantity: 3 },
      { label: '显示器', quantity: 2 },
    ])
  })

  it('隐藏已全部处置设备并将超过三类的剩余数量合并到第三行', () => {
    expect(rentalDeviceSummary([
      { ...item({ quantity: 1, boughtOutQuantity: 1 }), deviceType: '主机' },
      { ...item({ quantity: 2 }), deviceType: '台式机' },
      { ...item({ quantity: 2 }), deviceType: '显示器' },
      { ...item({ quantity: 1 }), deviceType: '笔记本' },
      { ...item({ quantity: 3 }), deviceType: '一体机' },
    ])).toEqual([
      { label: '主机', quantity: 2 },
      { label: '显示器', quantity: 2 },
      { label: '其他设备', quantity: 4 },
    ])
  })

  it.each([
    [[item()], '在租'],
    [[item({ returnedQuantity: 1 })], '部分退租'],
    [[item({ lostQuantity: 1 })], '部分丢失'],
    [[item({ boughtOutQuantity: 1 })], '部分买断'],
    [[item({ returnedQuantity: 5 })], '已退租'],
    [[item({ boughtOutQuantity: 5 })], '买断'],
    [[item({ quantity: 3, boughtOutQuantity: 2, returnedQuantity: 1 })], '已结束'],
    [[item({ returnedQuantity: 4, lostQuantity: 1 })], '已结束'],
  ])('根据设备处置数量得到合同状态', (items, expected) => {
    expect(rentalLifecycleStatus(items)).toBe(expected)
  })
})
