import { billPeriodRanges } from './rental-calculations'

export type BillingPeriod = {
  periodNo: number
  start: string
  endExclusive: string
  displayEnd: string
}

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) throw new Error('账期日期无效')
  return { year, month, day }
}

export function addCalendarMonths(date: string, months: number) {
  const { year, month, day } = parseDate(date)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function billingPeriod(anchorDate: string, periodNo: number): BillingPeriod {
  if (!Number.isInteger(periodNo) || periodNo < 1) throw new Error('期号必须大于 0')
  const start = addCalendarMonths(anchorDate, periodNo - 1)
  const endExclusive = addCalendarMonths(anchorDate, periodNo)
  return { periodNo, start, endExclusive, displayEnd: addCalendarDays(endExclusive, -1) }
}

export function billingPeriodAt(anchorDate: string, date: string): BillingPeriod {
  if (date < anchorDate) throw new Error(`${date} 不能早于账期起始日 ${anchorDate}`)
  for (let periodNo = 1; periodNo <= 1200; periodNo += 1) {
    const period = billingPeriod(anchorDate, periodNo)
    if (period.start <= date && date < period.endExclusive) return period
  }
  throw new Error(`无法定位 ${date} 所属的月租账期`)
}

export function periodNumberAt(anchorDate: string, boundaryDate: string) {
  const period = billingPeriodAt(anchorDate, boundaryDate)
  if (period.start === boundaryDate) return period.periodNo
  throw new Error(`${boundaryDate} 不是以 ${anchorDate} 为基准的账期起始日`)
}

export function billingPeriodLabel(period: BillingPeriod) {
  return `第 ${period.periodNo} 期：${period.start} 至 ${period.displayEnd}（含）`
}

type BillingPeriodBill = {
  id: number
  periodStart: string
  periodEnd: string
  dueDate?: string
}

type BillSettlement = BillingPeriodBill & {
  paidAmount: string | number
  status: string
}

const settledBillStatuses = new Set(['已结清', '已收款', '部分收款'])

/** 仅按账单对应的期号锁定，避免异常/重叠日期把尚未收款的下一期误锁。 */
export function isBillingPeriodLocked(anchorDate: string, periodNo: number, bills: BillSettlement[]) {
  const { ranges } = billPeriodRanges(bills, { anchorDate, unit: 'monthly' })
  return bills.some((bill) => {
    const range = ranges.get(bill.id)
    const settled = Number(bill.paidAmount) > 0 || settledBillStatuses.has(bill.status)
    return settled && Boolean(range && range.start <= periodNo && periodNo <= range.end)
  })
}

function billEndExclusive(bill: BillingPeriodBill) {
  // receivable_bills.periodEnd 在账务页统一按“含当日”展示，下一天才是不含边界。
  return addCalendarDays(bill.periodEnd, 1)
}

/**
 * 账单是已经发生的业务事实，优先级高于按起租日重新推算的自然月。
 * 历史合并账单仍沿用自然月拆分；能够明确对应单期的账单则覆盖该期，
 * 后续尚未出账的期数从最后一个真实账单边界继续顺延。
 */
export function billingPeriodsFromBills(anchorDate: string, bills: BillingPeriodBill[], lastPeriod: number) {
  const periods = Array.from({ length: lastPeriod }, (_, index) => billingPeriod(anchorDate, index + 1))
  if (!bills.length) return periods

  const { ranges } = billPeriodRanges(bills, { anchorDate, unit: 'monthly' })
  const exact = new Map<number, BillingPeriod>()
  for (const bill of bills) {
    const range = ranges.get(bill.id)
    if (!range || range.span !== 1 || range.start > lastPeriod) continue
    const endExclusive = billEndExclusive(bill)
    exact.set(range.start, {
      periodNo: range.start,
      start: bill.periodStart,
      endExclusive,
      displayEnd: addCalendarDays(endExclusive, -1),
    })
  }

  for (const [periodNo, period] of exact) periods[periodNo - 1] = period
  const lastExact = Math.max(0, ...exact.keys())
  for (let periodNo = lastExact + 1; periodNo <= lastPeriod; periodNo += 1) {
    const previous = periods[periodNo - 2]
    if (!previous) continue
    const start = previous.endExclusive
    const endExclusive = addCalendarMonths(start, 1)
    periods[periodNo - 1] = { periodNo, start, endExclusive, displayEnd: addCalendarDays(endExclusive, -1) }
  }
  return periods
}

export function billingPeriodFromBills(anchorDate: string, periodNo: number, bills: BillingPeriodBill[]) {
  return billingPeriodsFromBills(anchorDate, bills, periodNo)[periodNo - 1]
}

export function adjustablePeriodLimit(anchorDate: string, operationDate: string, billPeriodStarts: string[] = []) {
  const effectiveDate = operationDate < anchorDate ? anchorDate : operationDate
  const currentPeriod = billingPeriodAt(anchorDate, effectiveDate).periodNo
  const billPeriods = billPeriodStarts.flatMap((periodStart) => {
    try { return [periodNumberAt(anchorDate, periodStart)] } catch { return [] }
  })
  return Math.max(currentPeriod + 1, ...billPeriods)
}

export function effectiveBillingPeriod(anchorDate: string, operationDate: string) {
  const current = billingPeriodAt(anchorDate, operationDate)
  return current.start === operationDate
    ? current
    : billingPeriod(anchorDate, current.periodNo + 1)
}

export function billingPeriodOptions(input: {
  anchorDate: string
  operationDate: string
  endDate: string
  limit?: number
}) {
  const first = effectiveBillingPeriod(input.anchorDate, input.operationDate)
  const periods: BillingPeriod[] = []
  for (let periodNo = first.periodNo; periodNo <= first.periodNo + (input.limit ?? 24); periodNo += 1) {
    const period = billingPeriod(input.anchorDate, periodNo)
    if (period.start > input.endDate) break
    periods.push(period)
  }
  return periods
}
