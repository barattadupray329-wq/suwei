import { describe, expect, it } from 'vitest'
import { assertNoRentalActivity, assertOnlyInitialRentalPayments, assertSameDayOfficialRental, chinaDate } from '../lib/rental-trash-policy'

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

  it('仅有创建时租金和押金收款可撤销', () => {
    const payments = [
      { id: 1, feeType: '原合同租金', notes: '创建正式合同时即时收取租金', renewalRecordId: null, buyoutRecordId: null, returnRecordId: null, lossRecordId: null },
      { id: 2, feeType: '押金', notes: '创建正式合同时即时收取押金', renewalRecordId: null, buyoutRecordId: null, returnRecordId: null, lossRecordId: null },
    ]
    expect(() => assertOnlyInitialRentalPayments(payments, [1, 2], [2], 0)).not.toThrow()
  })

  it('额外收款或优惠存在时拒绝撤销', () => {
    const extra = { id: 3, feeType: '原合同租金', notes: '后续补收', renewalRecordId: null, buyoutRecordId: null, returnRecordId: null, lossRecordId: null }
    expect(() => assertOnlyInitialRentalPayments([extra], [3], [], 0)).toThrow('非创建阶段收款')
    expect(() => assertOnlyInitialRentalPayments([], [], [], 1)).toThrow('已有收款优惠')
  })

  it('不属于初始付款的资金流水会阻止撤销', () => {
    expect(() => assertOnlyInitialRentalPayments([], [], [99], 0)).toThrow('额外账务流水')
  })
})
