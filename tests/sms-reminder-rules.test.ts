import { describe, expect, it } from 'vitest'
import {
  beijingDate,
  hasRemainingRentalItems,
  remainingRentalQuantity,
} from '../lib/sms-reminder-rules'

describe('beijingDate', () => {
  it('按北京时间计算三天后的到期日期', () => {
    const timestamp = Date.parse('2026-07-26T16:30:00.000Z')
    expect(beijingDate(0, timestamp)).toBe('2026-07-27')
    expect(beijingDate(3, timestamp)).toBe('2026-07-30')
  })

  it('能正确跨月计算', () => {
    const timestamp = Date.parse('2026-07-30T16:30:00.000Z')
    expect(beijingDate(3, timestamp)).toBe('2026-08-03')
  })
})

describe('remainingRentalQuantity', () => {
  it('扣除买断、退租和丢失数量后计算剩余在租数量', () => {
    const items = [
      { quantity: 5, boughtOutQuantity: 1, returnedQuantity: 1, lostQuantity: 1 },
      { quantity: 2, boughtOutQuantity: 0, returnedQuantity: 1, lostQuantity: 0 },
    ]
    expect(remainingRentalQuantity(items)).toBe(3)
    expect(hasRemainingRentalItems(items)).toBe(true)
  })

  it('全部处置完成时不再发送到期提醒', () => {
    expect(hasRemainingRentalItems([
      { quantity: 2, boughtOutQuantity: 1, returnedQuantity: 1, lostQuantity: 0 },
      { quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 1 },
    ])).toBe(false)
  })

  it('异常超额处置数据不会产生负的在租数量', () => {
    expect(remainingRentalQuantity([
      { quantity: 1, boughtOutQuantity: 1, returnedQuantity: 1, lostQuantity: 0 },
    ])).toBe(0)
  })
})
