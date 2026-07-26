export const DAY_MS = 86_400_000

export function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式无效')
  return new Date(`${value}T00:00:00Z`)
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

const originalRentalBillTypes = new Set(['租金', '原合同租金', '起租预收', '日租租金', '原合同欠款补算'])

export function shouldSyncBillPeriod(bill: { billType: string; paidAmount: string | number }) {
  return originalRentalBillTypes.has(bill.billType) && toCents(bill.paidAmount) === 0
}

export function isDueWithin(endDate: string, today: string, days = 7) {
  return endDate >= today && endDate <= addCalendarDays(today, days)
}

export function renewalAmount(quantity: number, unitPrice: number, duration: number) {
  return fromCents(quantity * duration * toCents(unitPrice))
}

export function nextMonthlyPeriod(endDate: string) {
  return { periodStart: endDate, periodEnd: addCalendarMonths(endDate, 1) }
}

export function projectedMonthlyRent(items: Array<{ quantity: number; boughtOutQuantity: number; returnedQuantity: number; lostQuantity: number; monthlyRent: string | number }>) {
  const cents = items.reduce((total, item) => {
    const activeQuantity = Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity)
    return total + activeQuantity * toCents(item.monthlyRent)
  }, 0)
  return fromCents(cents)
}

export function effectiveOutstandingAmount(totalRent: string | number, paidAmount: string | number, billOutstanding: string | number) {
  const contractOutstandingCents = Math.max(0, toCents(totalRent) - toCents(paidAmount))
  return fromCents(Math.max(contractOutstandingCents, toCents(billOutstanding)))
}

export type SupplementalBill = {
  id: string
  kind: 'contract_gap' | 'projected_renewal'
  billType: string
  periodStart: string
  periodEnd: string
  dueDate: string
  amount: string
  paidAmount: string
  status: string
  notes: string
  isSupplemental: true
  periodCount?: number
}

export function overdueMonthlyPeriods(endDate: string, currentDate: string) {
  const periods: Array<{ periodStart: string; periodEnd: string }> = []
  let periodStart = endDate
  while (periodStart <= currentDate && periods.length < 1200) {
    const periodEnd = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd })
    periodStart = periodEnd
  }
  return periods
}

export function buildSupplementalBills(rental: { orderType: string; startDate: string; endDate: string; totalRent: string | number; paidAmount: string | number; status: string }, items: Array<{ quantity: number; boughtOutQuantity: number; returnedQuantity: number; lostQuantity: number; monthlyRent: string | number }>, bills: Array<{ billType: string; amount: string | number; paidAmount: string | number; periodStart?: string; periodEnd?: string }>, currentDate: string): SupplementalBill[] {
  const result: SupplementalBill[] = []
  const realOutstandingCents = bills.filter((bill) => bill.billType !== '押金').reduce((sum, bill) => sum + Math.max(0, toCents(bill.amount) - toCents(bill.paidAmount)), 0)
  const contractOutstandingCents = Math.max(0, toCents(rental.totalRent) - toCents(rental.paidAmount))
  const contractGapCents = Math.max(0, contractOutstandingCents - realOutstandingCents)
  if (contractGapCents > 0) result.push({ id: 'supplemental-contract-gap', kind: 'contract_gap', billType: '原合同欠款补算', periodStart: rental.startDate, periodEnd: rental.endDate, dueDate: rental.endDate, amount: fromCents(contractGapCents), paidAmount: '0.00', status: '待付款', notes: '根据合同总额减累计已收自动补算，仅用于展示。', isSupplemental: true })
  const activeStatuses = ['在租', '逾期', '部分买断', '部分退租', '部分丢失']
  const projectedAmount = projectedMonthlyRent(items)
  const overduePeriods = overdueMonthlyPeriods(rental.endDate, currentDate)
  const uncoveredPeriods = overduePeriods.filter((period) => !bills.some((bill) => bill.billType === '续租费' && bill.periodStart === period.periodStart && bill.periodEnd === period.periodEnd))
  if (rental.orderType === 'official' && activeStatuses.includes(rental.status) && toCents(projectedAmount) > 0 && uncoveredPeriods.length > 0) {
    const firstPeriod = uncoveredPeriods[0]
    const lastPeriod = uncoveredPeriods[uncoveredPeriods.length - 1]
    const amount = fromCents(toCents(projectedAmount) * uncoveredPeriods.length)
    result.push({ id: 'supplemental-projected-renewal', kind: 'projected_renewal', billType: '预计续租应收', periodStart: firstPeriod.periodStart, periodEnd: addCalendarDays(lastPeriod.periodEnd, -1), dueDate: firstPeriod.periodStart, amount, paidAmount: '0.00', status: '预计', notes: `已进入 ${uncoveredPeriods.length} 个续租账期：${uncoveredPeriods.map((period) => `${period.periodStart}–${period.periodEnd}`).join('、')}。办理续租后以正式账单为准。`, isSupplemental: true, periodCount: uncoveredPeriods.length })
  }
  return result
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
