import { describe, expect, it } from 'vitest'
import { assertNoRentalActivity, assertSameDayOfficialRental, chinaDate } from '../lib/rental-trash-policy'

describe('当天录错正式订单删除规则', () => {
  it('按中国时区判断同一天', () => {
    expect(chinaDate(new Date('2026-07-27T15:59:59.000Z'))).toBe('2026-07-27')
    expect(chinaDate(new Date('2026-07-27T16:00:00.000Z'))).toBe('2026-07-28')
  })

  it('允许中国时区同一天创建的订单', () => {
    expect(() => assertSameDayOfficialRental(
      new Date('2026-07-27T01:00:00.000Z'),
      new Date('2026-07-27T15:00:00.000Z'),
    )).not.toThrow()
  })

  it('拒绝跨日订单', () => {
    expect(() => assertSameDayOfficialRental(
      new Date('2026-07-26T15:59:59.000Z'),
      new Date('2026-07-27T00:00:00.000Z'),
    )).toThrow('仅允许删除今天创建的录错正式订单')
  })

  it('无后续业务记录时允许继续', () => {
    expect(() => assertNoRentalActivity([0, 0, 0, 0])).not.toThrow()
  })

  it('任一后续业务记录存在时拒绝', () => {
    expect(() => assertNoRentalActivity([0, 0, 1, 0])).toThrow('该订单已有收款或后续业务记录')
  })
})
