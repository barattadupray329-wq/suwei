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
