import { describe, expect, it } from 'vitest'
import { addCalendarMonths, billCoverageLabel, billPaymentPeriodSummary, billPeriodLabel, billPeriodRanges, billState, dueBillsAsOf, fromCents, isDueWithin, isRentChargeBillType, nextOpenBill, normalizeBillingUnit, periodUnitsBetween, renewalAdjustment, renewalAmount, rentalEndDate, toCents } from '../lib/rental-calculations'

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

describe('期数按自然月累计', () => {
  it('起租预收、续租费和逾期租金都参与合同期号，非租金费用不参与', () => {
    expect(isRentChargeBillType('起租预收')).toBe(true)
    expect(isRentChargeBillType('续租费')).toBe(true)
    expect(isRentChargeBillType('逾期续租租金')).toBe(true)
    expect(isRentChargeBillType('押金')).toBe(false)
    expect(isRentChargeBillType('维修费')).toBe(false)
  })
  const bill = (id: number, periodStart: string, periodEnd: string) => ({ id, periodStart, periodEnd, dueDate: periodStart })
  it('一期等于一个自然月', () => {
    expect(periodUnitsBetween('2026-03-01', '2026-04-01')).toBe(1)
    expect(periodUnitsBetween('2026-03-01', '2026-06-01')).toBe(3)
  })
  it('每张租金账单固定算一期，日期跨度不会合并期号', () => {
    const bills = [bill(1, '2026-03-01', '2026-05-31'), bill(2, '2026-06-01', '2026-06-30')]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-03-01' })
    expect(ranges.get(1)).toEqual({ start: 1, end: 1, span: 1 })
    expect(ranges.get(2)).toEqual({ start: 2, end: 2, span: 1 })
    expect(total).toBe(2)
    expect(billPeriodLabel(ranges.get(1))).toBe('第 1 期')
    expect(billPeriodLabel(ranges.get(2))).toBe('第 2 期')
  })
  it('逐月出账时期号与账单条数一致', () => {
    const bills = [bill(1, '2026-03-01', '2026-03-31'), bill(2, '2026-04-01', '2026-04-30'), bill(3, '2026-05-01', '2026-05-31')]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-03-01' })
    expect([...ranges.values()].map((range) => range.start)).toEqual([1, 2, 3])
    expect(total).toBe(3)
  })
  it('特殊按天只有 5 天也算完整一期', () => {
    const { ranges, total } = billPeriodRanges([bill(1, '2026-03-01', '2026-03-05')], { anchorDate: '2026-03-01', unit: 'daily' })
    expect(ranges.get(1)).toEqual({ start: 1, end: 1, span: 1 })
    expect(total).toBe(1)
    expect(billPeriodLabel(ranges.get(1), 'daily')).toBe('第 1 期')
  })
  it('续租账期与上一期重叠一天时仍是第 4 期', () => {
    // 历史数据里续租起始日取的是上一期最后一天（05-01~07-31 与 07-31~08-31 重叠一天）
    const bills = [bill(1, '2026-05-01', '2026-07-31'), bill(2, '2026-07-31', '2026-08-31')]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-05-01' })
    expect(ranges.get(1)).toEqual({ start: 1, end: 1, span: 1 })
    expect(ranges.get(2)).toEqual({ start: 2, end: 2, span: 1 })
    expect(total).toBe(2)
    expect(billPeriodLabel(ranges.get(2))).toBe('第 2 期')
  })
  it('历史多月账单也只显示为一期，不再拆分或合并', () => {
    const bills = [bill(1, '2026-05-01', '2026-07-31'), bill(2, '2026-08-01', '2026-09-30')]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-05-01' })
    expect(billPeriodLabel(ranges.get(2))).toBe('第 2 期')
    expect(total).toBe(2)
  })
  it('同一账期按设备拆单时共享期号且乱序输入不影响后续期数', () => {
    const bills = [
      bill(4, '2026-07-08', '2026-08-07'),
      bill(3, '2026-04-08', '2026-07-07'),
      bill(1, '2026-01-08', '2026-04-07'),
      bill(2, '2026-04-08', '2026-07-07'),
    ]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-01-08' })
    expect(ranges.get(1)).toEqual({ start: 1, end: 1, span: 1 })
    expect(ranges.get(2)).toEqual({ start: 2, end: 2, span: 1 })
    expect(ranges.get(3)).toEqual({ start: 2, end: 2, span: 1 })
    expect(ranges.get(4)).toEqual({ start: 3, end: 3, span: 1 })
    expect(total).toBe(3)
  })
  it('历史合并账单也只计一期，部分收款仍为未付一期', () => {
    const summary = billPaymentPeriodSummary([
      { ...bill(1, '2026-02-08', '2026-08-07'), amount: '1920', paidAmount: '1280' },
    ], { anchorDate: '2026-02-08' })
    expect(summary).toEqual({ total: 1, paid: 0, unpaid: 1 })
  })
  it('同账期拆单先汇总金额再计算且部分一期计入未付', () => {
    const summary = billPaymentPeriodSummary([
      { ...bill(1, '2026-01-08', '2026-04-07'), amount: '420', paidAmount: '320' },
      { ...bill(2, '2026-01-08', '2026-04-07'), amount: '60', paidAmount: '60' },
    ], { anchorDate: '2026-01-08' })
    expect(summary).toEqual({ total: 1, paid: 0, unpaid: 1 })
  })
  it('月租同日起止只算一个月且与设备台数无关', () => {
    const bills = [
      { ...bill(1, '2025-09-12', '2025-11-11'), amount: '200', paidAmount: '200' },
      { ...bill(2, '2025-11-12', '2026-07-11'), amount: '800', paidAmount: '800' },
      { ...bill(3, '2026-07-12', '2026-08-12'), amount: '100', paidAmount: '0' },
    ]
    const { ranges } = billPeriodRanges(bills, { anchorDate: '2025-09-12' })
    expect(ranges.get(3)).toEqual({ start: 3, end: 3, span: 1 })
    expect(billPaymentPeriodSummary(bills, { anchorDate: '2025-09-12' })).toEqual({ total: 3, paid: 2, unpaid: 1 })
  })
  it('一天间隔和边界重叠不会把一个月续租账单扩成两期', () => {
    const bills = [
      bill(1, '2026-05-07', '2026-07-06'),
      bill(2, '2026-07-08', '2026-08-07'),
      bill(3, '2026-08-07', '2026-09-07'),
    ]
    const { ranges, total } = billPeriodRanges(bills, { anchorDate: '2026-05-07' })
    expect(ranges.get(1)).toEqual({ start: 1, end: 1, span: 1 })
    expect(ranges.get(2)).toEqual({ start: 2, end: 2, span: 1 })
    expect(ranges.get(3)).toEqual({ start: 3, end: 3, span: 1 })
    expect(total).toBe(3)
  })
  it('缺少起租日时以首笔账期为锚点', () => {
    const { ranges } = billPeriodRanges([bill(1, '2026-05-01', '2026-07-31'), bill(2, '2026-07-31', '2026-08-31')])
    expect(ranges.get(2)).toEqual({ start: 2, end: 2, span: 1 })
  })
  it('不足整月的尾段仍算一期', () => expect(periodUnitsBetween('2026-03-01', '2026-03-20')).toBe(1))
  it('计费方式归一化', () => {
    expect(normalizeBillingUnit('日租')).toBe('daily')
    expect(normalizeBillingUnit('monthly')).toBe('monthly')
    expect(normalizeBillingUnit(null)).toBe('monthly')
  })
})

describe('租赁金额计算', () => {
  it('使用整数分避免浮点误差', () => expect(fromCents(toCents(0.1) + toCents(0.2))).toBe('0.30'))
  it('续租按数量、单价和时长计算', () => expect(renewalAmount(3, 99.99, 2)).toBe('599.94'))
  it('续租涨价生成补收差额', () => expect(renewalAdjustment(2, 3, 600, 120)).toEqual({ correctedAmount: '720.00', differenceAmount: '120.00' }))
  it('续租降价生成减免差额', () => expect(renewalAdjustment(2, 3, 600, 80)).toEqual({ correctedAmount: '480.00', differenceAmount: '-120.00' }))
  it('连续更正以当前有效金额为基准', () => expect(renewalAdjustment(2, 3, 720, 90)).toEqual({ correctedAmount: '540.00', differenceAmount: '-180.00' }))
})
