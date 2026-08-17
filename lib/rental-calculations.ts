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

export function assertNoOutstandingRentBills<T extends { id: number; billType: string; periodStart: string; periodEnd: string; amount: number | string; paidAmount: number | string }>(bills: T[]) {
  const open = bills
    .filter((bill) => bill.billType !== '押金' && toCents(bill.amount) > toCents(bill.paidAmount))
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart) || left.id - right.id)
  if (!open.length) return
  const earliest = open[0]
  throw new Error(`请先处理 ${earliest.periodStart} 至 ${earliest.periodEnd} 的未收租金，再办理后续续租`)
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

/** 所有参与合同租金期号的账单类型，供账务、调租、续租和结算统一使用。 */
export function isRentChargeBillType(billType: string) {
  return billType === '起租预收' || billType === '续租费' || billType.includes('租金')
}

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
    } else {
      // 业务规则：一张租金账单就是一期。无论该期是整月还是特殊的若干天，
      // 都不能按日期跨度合并成多期；只有同一账期按设备拆单时共享同一期号。
      start = cursor + 1
      end = start
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

export function billPeriodLabel(range: BillPeriodRange | undefined, _unit: BillingUnit = 'monthly') {
  if (!range) return '第 1 期'
  return range.span > 1 ? `第 ${range.start}-${range.end} 期` : `第 ${range.start} 期`
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
