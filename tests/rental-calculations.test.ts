import { describe, expect, it } from 'vitest'
import { addCalendarMonths, billCoverageLabel, billState, buildSupplementalBills, dueBillsAsOf, effectiveOutstandingAmount, fromCents, isDueWithin, nextMonthlyPeriod, nextOpenBill, overdueMonthlyPeriods, projectedMonthlyRent, paymentRentAdjustment, renewalAdjustment, renewalAmount, rentalEndDate, shouldSyncBillPeriod, toCents } from '../lib/rental-calculations'

describe('收款联动调整后续月租', () => {
  it('5 台应收 600 实收 500 时每台调整为 100 元', () => {
    expect(paymentRentAdjustment(600, 500, 5)).toEqual({ newUnitPrice: '100.00', discountAmount: '100.00', newMonthlyTotal: '500.00' })
  })
  it('按分无法整除时拒绝自动调整', () => expect(() => paymentRentAdjustment(600, 500, 3)).toThrow('无法按在租台数精确分摊'))
  it('没有在租设备时拒绝调整', () => expect(() => paymentRentAdjustment(600, 500, 0)).toThrow('没有可调整租金'))
  it('全额或超额收款时拒绝调整', () => {
    expect(() => paymentRentAdjustment(600, 600, 5)).toThrow('仅适用于少于本期待收')
    expect(() => paymentRentAdjustment(600, 700, 5)).toThrow('仅适用于少于本期待收')
  })
})

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

describe('租期调整账单同步', () => {
  it('兼容历史零金额格式与原合同账单类型', () => {
    expect(shouldSyncBillPeriod({ billType: '起租预收', paidAmount: '0' })).toBe(true)
    expect(shouldSyncBillPeriod({ billType: '租金', paidAmount: '0.00' })).toBe(true)
    expect(shouldSyncBillPeriod({ billType: '原合同租金', paidAmount: '0.0' })).toBe(true)
    expect(shouldSyncBillPeriod({ billType: '原合同欠款补算', paidAmount: 0 })).toBe(true)
  })
  it('不修改部分收款、续租和其他费用账单', () => {
    expect(shouldSyncBillPeriod({ billType: '起租预收', paidAmount: '0.01' })).toBe(false)
    expect(shouldSyncBillPeriod({ billType: '续租费', paidAmount: '0.00' })).toBe(false)
    expect(shouldSyncBillPeriod({ billType: '押金', paidAmount: '0.00' })).toBe(false)
    expect(shouldSyncBillPeriod({ billType: '合同变更费', paidAmount: '0.00' })).toBe(false)
  })
})

describe('租赁金额计算', () => {
  it('5 月 12 日到期至 7 月 26 日累计三个续租账期', () => {
    expect(overdueMonthlyPeriods('2026-05-12', '2026-07-26')).toEqual([
      { periodStart: '2026-05-12', periodEnd: '2026-06-12' },
      { periodStart: '2026-06-12', periodEnd: '2026-07-12' },
      { periodStart: '2026-07-12', periodEnd: '2026-08-12' },
    ])
    const rental = { orderType: 'official', startDate: '2025-06-24', endDate: '2026-05-12', totalRent: '1500', paidAmount: '1500', status: '在租' }
    const items = [{ quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 0, monthlyRent: '150' }]
    expect(buildSupplementalBills(rental, items, [], '2026-07-26').find((bill) => bill.kind === 'projected_renewal')).toMatchObject({ amount: '450.00', periodStart: '2026-05-12', periodEnd: '2026-08-11', periodCount: 3 })
  })
  it('付款日当天已经进入新一期', () => expect(overdueMonthlyPeriods('2026-05-12', '2026-05-12')).toHaveLength(1))
  it('月底与闰年逐期衔接', () => expect(overdueMonthlyPeriods('2028-01-31', '2028-03-01')).toEqual([
    { periodStart: '2028-01-31', periodEnd: '2028-02-29' },
    { periodStart: '2028-02-29', periodEnd: '2028-03-29' },
  ]))
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
  it('历史账单缺失时按合同总额减已收计算欠款', () => expect(effectiveOutstandingAmount('900', '720', '0')).toBe('180.00'))
  it('账单完整时不重复累计合同欠款', () => expect(effectiveOutstandingAmount('900', '720', '180')).toBe('180.00'))
  it('续租账单高于原合同欠款时采用账单未收', () => expect(effectiveOutstandingAmount('900', '900', '90')).toBe('90.00'))
  it('生成原合同欠款和预计续租两条只读明细', () => {
    const rental = { orderType: 'official', startDate: '2026-03-13', endDate: '2026-07-12', totalRent: '900', paidAmount: '720', status: '部分退租' }
    const items = [{ quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 0, monthlyRent: '90' }]
    expect(buildSupplementalBills(rental, items, [], '2026-07-26').map((bill) => ({ kind: bill.kind, amount: bill.amount }))).toEqual([
      { kind: 'contract_gap', amount: '180.00' },
      { kind: 'projected_renewal', amount: '90.00' },
    ])
  })
  it('历史续租账单不阻断下一账期预测', () => {
    const rental = { orderType: 'official', startDate: '2026-03-13', endDate: '2026-07-12', totalRent: '900', paidAmount: '900', status: '在租' }
    const items = [{ quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 0, monthlyRent: '90' }]
    const bills = [{ billType: '续租费', amount: '90', paidAmount: '90', periodStart: '2026-06-12', periodEnd: '2026-07-12' }]
    expect(buildSupplementalBills(rental, items, bills, '2026-07-26').some((bill) => bill.kind === 'projected_renewal')).toBe(true)
  })
  it('目标账期已有续租账单时不再预测', () => {
    const rental = { orderType: 'official', startDate: '2026-03-13', endDate: '2026-07-12', totalRent: '990', paidAmount: '900', status: '在租' }
    const items = [{ quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 0, monthlyRent: '90' }]
    const bills = [{ billType: '续租费', amount: '90', paidAmount: '0', periodStart: '2026-07-12', periodEnd: '2026-08-12' }]
    expect(buildSupplementalBills(rental, items, bills, '2026-07-26').some((bill) => bill.kind === 'projected_renewal')).toBe(false)
  })
  it('已有完整原合同账单时不重复补算', () => {
    const rental = { orderType: 'official', startDate: '2026-03-13', endDate: '2026-07-12', totalRent: '900', paidAmount: '720', status: '部分退租' }
    const items = [{ quantity: 1, boughtOutQuantity: 0, returnedQuantity: 0, lostQuantity: 0, monthlyRent: '90' }]
    const bills = [{ billType: '原合同租金', amount: '900', paidAmount: '720' }]
    expect(buildSupplementalBills(rental, items, bills, '2026-07-26').some((bill) => bill.kind === 'contract_gap')).toBe(false)
  })
  it('使用整数分避免浮点误差', () => expect(fromCents(toCents(0.1) + toCents(0.2))).toBe('0.30'))
  it('续租按数量、单价和时长计算', () => expect(renewalAmount(3, 99.99, 2)).toBe('599.94'))
  it('续租涨价生成补收差额', () => expect(renewalAdjustment(2, 3, 600, 120)).toEqual({ correctedAmount: '720.00', differenceAmount: '120.00' }))
  it('续租降价生成减免差额', () => expect(renewalAdjustment(2, 3, 600, 80)).toEqual({ correctedAmount: '480.00', differenceAmount: '-120.00' }))
  it('连续更正以当前有效金额为基准', () => expect(renewalAdjustment(2, 3, 720, 90)).toEqual({ correctedAmount: '540.00', differenceAmount: '-180.00' }))
})
