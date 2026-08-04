export const DAY_MS = 86_400_000

export function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式无效')
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('日期不存在')
  return date
}

export function assertDateOrder(startDate: string, endDate: string, message = '结束日期不能早于开始日期') {
  dateOnly(startDate)
  dateOnly(endDate)
  if (endDate < startDate) throw new Error(message)
}

export function inclusiveDays(startDate: string, endDate: string) {
  assertDateOrder(startDate, endDate)
  return Math.floor((dateOnly(endDate).getTime() - dateOnly(startDate).getTime()) / DAY_MS) + 1
}

export function addCalendarDays(value: string, days: number) {
  const date = dateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addCalendarMonths(value: string, months: number) {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export function rentalEndDate(startDate: string, duration: number, unit: 'daily' | 'monthly') {
  return unit === 'daily' ? addCalendarDays(startDate, duration - 1) : addCalendarDays(addCalendarMonths(startDate, duration), -1)
}

export function toCents(value: number | string) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error('金额格式无效')
  return Math.round(number * 100)
}

export function fromCents(value: number) {
  return (value / 100).toFixed(2)
}

export function isDueWithin(endDate: string, today: string, days = 7) {
  return endDate >= today && endDate <= addCalendarDays(today, days)
}

export function renewalAmount(quantity: number, unitPrice: number, duration: number) {
  return fromCents(quantity * duration * toCents(unitPrice))
}

export function renewalAdjustment(quantity: number, duration: number, currentAmount: number | string, correctedUnitPrice: number | string) {
  const correctedAmountCents = quantity * duration * toCents(correctedUnitPrice)
  const differenceCents = correctedAmountCents - toCents(currentAmount)
  return { correctedAmount: fromCents(correctedAmountCents), differenceAmount: fromCents(differenceCents) }
}

export type BillState = '已结清' | '部分收款' | '逾期' | '即将到期' | '待付款'

export function billState(amount: number | string, paidAmount: number | string, dueDate: string, currentDate: string, warningDays = 7): BillState {
  const amountCents = toCents(amount)
  const paidCents = toCents(paidAmount)
  if (paidCents >= amountCents) return '已结清'
  if (paidCents > 0) return '部分收款'
  if (dueDate < currentDate) return '逾期'
  if (dueDate <= addCalendarDays(currentDate, warningDays)) return '即将到期'
  return '待付款'
}

export function billCoverageLabel(periodStart: string, periodEnd: string) {
  return `${periodStart} 至 ${addCalendarDays(periodEnd, 1)}（不含）`
}

export type BillingUnit = 'daily' | 'monthly'

export function normalizeBillingUnit(value?: string | null): BillingUnit {
  return value === 'daily' || value === '日租' || value === '日' ? 'daily' : 'monthly'
}

// 一期 = 一个自然月（日租则一期 = 一天），与账单条数无关：
// 起租开 3 个月的账单占第 1-3 期，之后续租 1 个月就是第 4 期。
export function periodUnitsBetween(startDate: string, endExclusive: string, unit: BillingUnit = 'monthly') {
  assertDateOrder(startDate, endExclusive)
  if (unit === 'daily') return Math.max(1, Math.floor((dateOnly(endExclusive).getTime() - dateOnly(startDate).getTime()) / DAY_MS))
  let months = 0
  while (months < 1200 && addCalendarMonths(startDate, months + 1) <= endExclusive) months += 1
  // 不足整月的尾段按一期计，避免出现「第 0 期」
  return addCalendarMonths(startDate, months) < endExclusive ? months + 1 : Math.max(1, months)
}

export type BillPeriodRange = { start: number; end: number; span: number }

export function billPeriodRanges<T extends { id: number; periodStart: string; periodEnd: string; dueDate?: string }>(
  bills: T[],
  options: { anchorDate?: string | null; unit?: BillingUnit } = {},
) {
  const unit = options.unit ?? 'monthly'
  const anchorDate = options.anchorDate ?? null
  const sorted = [...bills].sort((left, right) => left.periodStart.localeCompare(right.periodStart) || (left.dueDate ?? '').localeCompare(right.dueDate ?? '') || left.id - right.id)
  const ranges = new Map<number, BillPeriodRange>()
  let cursor = 0
  let total = 0
  for (const bill of sorted) {
    let span = 1
    try {
      span = periodUnitsBetween(bill.periodStart, addCalendarDays(bill.periodEnd, 1), unit)
    } catch {
      span = 1
    }
    let start = cursor + 1
    if (anchorDate && bill.periodStart > anchorDate) {
      try {
        const offset = periodUnitsBetween(anchorDate, bill.periodStart, unit)
        const aligned = unit === 'daily' ? addCalendarDays(anchorDate, offset) === bill.periodStart : addCalendarMonths(anchorDate, offset) === bill.periodStart
        if (aligned) start = offset + 1
      } catch {
        start = cursor + 1
      }
    } else if (anchorDate && bill.periodStart === anchorDate) {
      start = 1
    }
    const end = start + span - 1
    ranges.set(bill.id, { start, end, span })
    cursor = Math.max(cursor, end)
    total = Math.max(total, end)
  }
  return { ranges, total, unit }
}

export function billPeriodLabel(range: BillPeriodRange | undefined, unit: BillingUnit = 'monthly') {
  if (!range) return unit === 'daily' ? '第 1 天' : '第 1 期'
  const suffix = unit === 'daily' ? '天' : '期'
  return range.span > 1 ? `第 ${range.start}-${range.end} ${suffix}` : `第 ${range.start} ${suffix}`
}

export function nextOpenBill<T extends { amount: string | number; paidAmount: string | number; dueDate: string }>(bills: T[]) {
  return bills
    .filter((bill) => toCents(bill.amount) > toCents(bill.paidAmount))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
}

export function dueBillsAsOf<T extends { amount: string | number; paidAmount: string | number; dueDate: string }>(bills: T[], currentDate: string) {
  return bills
    .filter((bill) => bill.dueDate <= currentDate && toCents(bill.amount) > toCents(bill.paidAmount))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
