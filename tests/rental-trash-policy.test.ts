import { describe, expect, it } from 'vitest'
import { assertOfficialRentalDeletable, chinaDate, OFFICIAL_DELETE_WINDOW_DAYS } from '../lib/rental-trash-policy'

describe('录错正式订单删除规则', () => {
  it('按中国时区格式化日期', () => {
    expect(chinaDate(new Date('2026-07-27T15:59:59.000Z'))).toBe('2026-07-27')
    expect(chinaDate(new Date('2026-07-27T16:00:00.000Z'))).toBe('2026-07-28')
  })

  it('删除窗口为录单后 7 天', () => {
    expect(OFFICIAL_DELETE_WINDOW_DAYS).toBe(7)
  })

  it('允许录单当天及 7 天内删除', () => {
    const createdAt = new Date('2026-07-01T02:00:00.000Z')
    expect(() => assertOfficialRentalDeletable(createdAt, new Date('2026-07-01T05:00:00.000Z'))).not.toThrow()
    expect(() => assertOfficialRentalDeletable(createdAt, new Date('2026-07-08T01:00:00.000Z'))).not.toThrow()
  })

  it('按录单时间判定，超过 7 天拒绝删除', () => {
    const createdAt = new Date('2026-07-01T02:00:00.000Z')
    expect(() => assertOfficialRentalDeletable(createdAt, new Date('2026-07-08T03:00:00.000Z'))).toThrow('7 天')
  })
})
