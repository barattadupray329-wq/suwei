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

export function overdueBillingMonths(endDate: string, today: string) {
  if (endDate >= today) return 0
  const overdueDays = Math.floor((dateOnly(today).getTime() - dateOnly(endDate).getTime()) / DAY_MS)
  return Math.ceil(overdueDays / 30)
}

export function overdueMonthlyAmount(monthlyRent: number | string, endDate: string, today: string) {
  return fromCents(toCents(monthlyRent) * overdueBillingMonths(endDate, today))
}

export function renewalAdjustment(quantity: number, duration: number, currentAmount: number | string, correctedUnitPrice: number | string) {
  const correctedAmountCents = quantity * duration * toCents(correctedUnitPrice)
  const differenceCents = correctedAmountCents - toCents(currentAmount)
  return { correctedAmount: fromCents(correctedAmountCents), differenceAmount: fromCents(differenceCents) }
}

export function proratedMonthlyRentChange(input: {
  effectiveDate: string
  oldMonthlyRent: number | string
  newMonthlyRent: number | string
  quantity: number
}) {
  const effective = dateOnly(input.effectiveDate)
  const daysInMonth = new Date(Date.UTC(effective.getUTCFullYear(), effective.getUTCMonth() + 1, 0)).getUTCDate()
  const oldDays = effective.getUTCDate() - 1
  const newDays = daysInMonth - oldDays
  const oldCents = toCents(input.oldMonthlyRent)
  const newCents = toCents(input.newMonthlyRent)
  const quantity = Math.max(1, Math.floor(input.quantity))
  const oldPortionCents = Math.round((oldCents * oldDays * quantity) / daysInMonth)
  const newPortionCents = Math.round((newCents * newDays * quantity) / daysInMonth)
  const originalMonthCents = oldCents * quantity
  const adjustedMonthCents = oldPortionCents + newPortionCents
  return {
    daysInMonth,
    oldDays,
    newDays,
    oldPortion: fromCents(oldPortionCents),
    newPortion: fromCents(newPortionCents),
    adjustedMonthAmount: fromCents(adjustedMonthCents),
    differenceAmount: fromCents(adjustedMonthCents - originalMonthCents),
    futureMonthlyDifference: fromCents((newCents - oldCents) * quantity),
  }
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
