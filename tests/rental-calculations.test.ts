import { describe, expect, it } from 'vitest'
import { addCalendarMonths, billCoverageLabel, billState, dueBillsAsOf, fromCents, isDueWithin, nextMonthlyPeriod, nextOpenBill, projectedMonthlyRent, renewalAdjustment, renewalAmount, rentalEndDate, toCents } from '../lib/rental-calculations'

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

describe('预收与续租账单', () => {
  it('3 月 1 日起租 3 个月覆盖至 6 月 1 日（不含）', () => {
    expect(billCoverageLabel('2026-03-01', rentalEndDate('2026-03-01', 3, 'monthly'))).toBe('2026-03-01 至 2026-06-01（不含）')
  })
  it('优先返回最早的未结清账单', () => {
    const bills = [
      { dueDate: '2026-07-01', amount: '100', paidAmount: '0' },
      { dueDate: '2026-06-01', amount: '200', paidAmount: '200' },
      { dueDate: '2026-06-15', amount: '300', paidAmount: '100' },
    ]
    expect(nextOpenBill(bills)?.dueDate).toBe('2026-06-15')
  })
  it('6 日只显示 5 日已到付款日账单，隐藏 20 日账单', () => {
    const bills = [
      { dueDate: '2026-08-05', amount: '100', paidAmount: '0' },
      { dueDate: '2026-08-20', amount: '200', paidAmount: '0' },
    ]
    expect(dueBillsAsOf(bills, '2026-08-06')).toEqual([bills[0]])
  })
  it('付款日当天计入当前应付，次日才为逾期', () => {
    const bill = { dueDate: '2026-08-05', amount: '100', paidAmount: '0' }
    expect(dueBillsAsOf([bill], '2026-08-05')).toEqual([bill])
    expect(billState('100', '0', '2026-08-05', '2026-08-05')).not.toBe('逾期')
    expect(billState('100', '0', '2026-08-05', '2026-08-06')).toBe('逾期')
  })
  it('按结清、部分收款、逾期、即将到期和待付款区分状态', () => {
    expect(billState('100', '100', '2026-06-01', '2026-06-10')).toBe('已结清')
    expect(billState('100', '20', '2026-06-01', '2026-06-10')).toBe('部分收款')
    expect(billState('100', '0', '2026-06-01', '2026-06-10')).toBe('逾期')
    expect(billState('100', '0', '2026-06-15', '2026-06-10')).toBe('即将到期')
    expect(billState('100', '0', '2026-07-01', '2026-06-10')).toBe('待付款')
  })
})

describe('租赁金额计算', () => {
  it('到期后默认预测下一个自然月', () => {
    expect(nextMonthlyPeriod('2026-07-03')).toEqual({ periodStart: '2026-07-03', periodEnd: '2026-08-03' })
    expect(nextMonthlyPeriod('2026-01-31')).toEqual({ periodStart: '2026-01-31', periodEnd: '2026-02-28' })
  })
  it('下一期租金只计算仍在租设备', () => {
    expect(projectedMonthlyRent([
      { quantity: 4, boughtOutQuantity: 1, returnedQuantity: 1, lostQuantity: 0, monthlyRent: '99.99' },
      { quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 1, monthlyRent: '300' },
    ])).toBe('199.98')
  })
  it('使用整数分避免浮点误差', () => expect(fromCents(toCents(0.1) + toCents(0.2))).toBe('0.30'))
  it('续租按数量、单价和时长计算', () => expect(renewalAmount(3, 99.99, 2)).toBe('599.94'))
  it('续租涨价生成补收差额', () => expect(renewalAdjustment(2, 3, 600, 120)).toEqual({ correctedAmount: '720.00', differenceAmount: '120.00' }))
  it('续租降价生成减免差额', () => expect(renewalAdjustment(2, 3, 600, 80)).toEqual({ correctedAmount: '480.00', differenceAmount: '-120.00' }))
  it('连续更正以当前有效金额为基准', () => expect(renewalAdjustment(2, 3, 720, 90)).toEqual({ correctedAmount: '540.00', differenceAmount: '-180.00' }))
})
