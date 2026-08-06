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

// 已完整走过的期数（向下取整）：锚点 05-01 到 07-31 只走满 2 个月
function elapsedUnits(anchorDate: string, date: string, unit: BillingUnit) {
  if (date <= anchorDate) return 0
  if (unit === 'daily') return Math.max(0, Math.floor((dateOnly(date).getTime() - dateOnly(anchorDate).getTime()) / DAY_MS))
  let months = 0
  while (months < 1200 && addCalendarMonths(anchorDate, months + 1) <= date) months += 1
  return months
}

// 覆盖到该日期（不含）所需的期数（向上取整）：锚点 05-01 到 09-01 需要 4 期
function coveredUnits(anchorDate: string, endExclusive: string, unit: BillingUnit) {
  const elapsed = elapsedUnits(anchorDate, endExclusive, unit)
  if (unit === 'daily') return Math.max(1, elapsed)
  return Math.max(1, addCalendarMonths(anchorDate, elapsed) < endExclusive ? elapsed + 1 : elapsed)
}

export type BillPeriodRange = { start: number; end: number; span: number }

export function billPeriodRanges<T extends { id: number; periodStart: string; periodEnd: string; dueDate?: string }>(
  bills: T[],
  options: { anchorDate?: string | null; unit?: BillingUnit } = {},
) {
  const unit = options.unit ?? 'monthly'
  const sorted = [...bills].sort((left, right) => left.periodStart.localeCompare(right.periodStart) || (left.dueDate ?? '').localeCompare(right.dueDate ?? '') || left.id - right.id)
  const anchorDate = options.anchorDate ?? sorted[0]?.periodStart ?? null
  const ranges = new Map<number, BillPeriodRange>()
  let cursor = 0
  let total = 0
  let previous: T | null = null
  let previousRange: BillPeriodRange | null = null
  for (const bill of sorted) {
    let start = cursor + 1
    let end = start
    const sharesPreviousPeriod = previous?.periodStart === bill.periodStart && previous.periodEnd === bill.periodEnd
    if (sharesPreviousPeriod && previousRange) {
      // 同一账期可能按设备拆成多笔账单，它们共享期号，不应被误算成后续期数。
      start = previousRange.start
      end = previousRange.end
    } else if (anchorDate) {
      try {
        // 期号一律相对起租日推算，续租账单落在哪个自然月就是第几期；
        // cursor 用于兜底历史数据里账期首尾相接（重叠一天）导致的期号回退。
        start = Math.max(cursor + 1, elapsedUnits(anchorDate, bill.periodStart, unit) + 1)
        // 月租账单存在两种历史边界：月末日期为含当日，同日起止（如 07-12 至 08-12）则结束日为不含。
        // 两者都只代表一个月，设备数量不参与期数计算。
        const endExclusive = unit === 'monthly' && bill.periodStart.slice(8) === bill.periodEnd.slice(8)
          ? bill.periodEnd
          : addCalendarDays(bill.periodEnd, 1)
        end = Math.max(start, coveredUnits(anchorDate, endExclusive, unit))
      } catch {
        start = cursor + 1
        end = start
      }
    }
    const range = { start, end, span: end - start + 1 }
    ranges.set(bill.id, range)
    cursor = Math.max(cursor, end)
    total = Math.max(total, end)
    previous = bill
    previousRange = range
  }
  return { ranges, total, unit }
}

export function billPeriodLabel(range: BillPeriodRange | undefined, unit: BillingUnit = 'monthly') {
  if (!range) return unit === 'daily' ? '第 1 天' : '第 1 期'
  const suffix = unit === 'daily' ? '天' : '期'
  return range.span > 1 ? `第 ${range.start}-${range.end} ${suffix}` : `第 ${range.start} ${suffix}`
}

export function billPaymentPeriodSummary<T extends { id: number; periodStart: string; periodEnd: string; dueDate?: string; amount: string | number; paidAmount: string | number }>(
  bills: T[],
  options: { anchorDate?: string | null; unit?: BillingUnit } = {},
) {
  const { ranges } = billPeriodRanges(bills, options)
  const groups = new Map<string, { span: number; amountCents: number; paidCents: number }>()

  for (const bill of bills) {
    const range = ranges.get(bill.id)
    if (!range) continue
    const key = `${range.start}-${range.end}`
    const current = groups.get(key) ?? { span: range.span, amountCents: 0, paidCents: 0 }
    groups.set(key, {
      span: range.span,
      amountCents: current.amountCents + Math.max(0, toCents(bill.amount)),
      paidCents: current.paidCents + Math.max(0, Math.min(toCents(bill.amount), toCents(bill.paidAmount))),
    })
  }

  let paid = 0
  let unpaid = 0
  for (const group of groups.values()) {
    // 多期合并开票时按金额折算完整已付期数；不足一期的部分仍归入未付。
    const paidInGroup = group.amountCents > 0
      ? Math.min(group.span, Math.floor((group.paidCents * group.span) / group.amountCents))
      : 0
    paid += paidInGroup
    unpaid += group.span - paidInGroup
  }
  return { total: paid + unpaid, paid, unpaid }
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
