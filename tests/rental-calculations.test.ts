import { describe, expect, it } from 'vitest'
import { addCalendarMonths, fromCents, isDueWithin, renewalAmount, rentalEndDate, toCents } from '../lib/rental-calculations'

describe('租赁日期计算', () => {
  it('日租首尾日期均计费', () => expect(rentalEndDate('2026-07-22', 30, 'daily')).toBe('2026-08-20'))
  it('月租两个月按起租日计算到期日', () => expect(rentalEndDate('2026-07-16', 2, 'monthly')).toBe('2026-09-15'))
  it('月底月租不会溢出', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(rentalEndDate('2026-01-31', 1, 'monthly')).toBe('2026-02-27')
  })
  it('闰年月底正确', () => expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29'))
  it('7 天到期不包含历史逾期', () => {
    expect(isDueWithin('2026-07-22', '2026-07-22')).toBe(true)
    expect(isDueWithin('2026-07-29', '2026-07-22')).toBe(true)
    expect(isDueWithin('2026-07-21', '2026-07-22')).toBe(false)
    expect(isDueWithin('2026-07-30', '2026-07-22')).toBe(false)
  })
})

describe('租赁金额计算', () => {
  it('使用整数分避免浮点误差', () => expect(fromCents(toCents(0.1) + toCents(0.2))).toBe('0.30'))
  it('续租按数量、单价和时长计算', () => expect(renewalAmount(3, 99.99, 2)).toBe('599.94'))
})
