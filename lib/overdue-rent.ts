import { addCalendarDays, addCalendarMonths, toCents } from './rental-calculations'

export type RentalDisposal = { rentalItemId: number; quantity: number; date: string }
export type ReturnBillingMode = 'full_month' | 'daily' | 'waive' | 'late_daily' | 'late_monthly' | 'late_waive'

const DAY_MS = 86_400_000
const daysBetween = (start: string, end: string) => Math.max(0, Math.ceil((Date.parse(`${end}T00:00:00+08:00`) - Date.parse(`${start}T00:00:00+08:00`)) / DAY_MS))

export type ReturnTiming = 'early' | 'on_time' | 'late'

export function returnTiming(returnDate: string, endDate: string): ReturnTiming {
  return returnDate < endDate ? 'early' : returnDate > endDate ? 'late' : 'on_time'
}

export function returnRentDecision(input: { startDate: string; endDate: string; returnDate: string; monthlyRent: string; quantity: number; mode: ReturnBillingMode }) {
  const timing = returnTiming(input.returnDate, input.endDate)
  const fullAmountCents = toCents(input.monthlyRent) * input.quantity
  if (timing === 'late') {
    const lateDays = daysBetween(input.endDate, input.returnDate)
    const chargeCents = input.mode === 'late_waive' ? 0 : input.mode === 'late_monthly' ? Math.ceil(lateDays / 30) * fullAmountCents : Math.round(fullAmountCents * lateDays / 30)
    return { timing, usedDays: 0, remainingDays: 0, lateDays, chargeCents, adjustmentCents: 0 }
  }
  if (timing === 'on_time') return { timing, usedDays: 30, remainingDays: 0, lateDays: 0, chargeCents: 0, adjustmentCents: 0 }
  const usedDays = Math.max(1, Math.min(30, daysBetween(input.startDate, input.returnDate) + 1))
  const chargeCents = input.mode === 'waive' ? 0 : input.mode === 'daily' ? Math.round(fullAmountCents * usedDays / 30) : fullAmountCents
  return { timing, usedDays, remainingDays: 30 - usedDays, lateDays: 0, chargeCents: 0, adjustmentCents: fullAmountCents - chargeCents }
}

export function priceChangeAdjustment(input: { periodStart: string; periodEnd: string; effectiveDate: string; oldMonthlyRent: string; newMonthlyRent: string; quantity: number }) {
  if (input.effectiveDate !== input.periodStart) {
    throw new Error(`租金只能从完整账期开始调整，请选择 ${input.periodStart}`)
  }
  const adjustmentCents =
    (toCents(input.newMonthlyRent) - toCents(input.oldMonthlyRent)) * input.quantity
  return { periodStart: input.periodStart, periodEnd: input.periodEnd, adjustmentCents }
}

export function overdueRentPeriods(endDate: string, today: string) {
  const periods: Array<{ periodStart: string; periodEnd: string }> = []
  // 合同 endDate 为含当日；下一期必须从次日开始，不能与上一期重叠。
  let periodStart = addCalendarDays(endDate, 1)
  while (periodStart <= today) {
    const nextPeriodStart = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd: addCalendarDays(nextPeriodStart, -1) })
    periodStart = nextPeriodStart
  }
  return periods
}

export function returnBillingAdjustment(input: { periodStart: string; periodEnd?: string; returnDate: string; monthlyRent: string; quantity: number; mode: ReturnBillingMode }) {
  const fullAmountCents = toCents(input.monthlyRent) * input.quantity
  const lateMode = input.mode === 'late_daily' || input.mode === 'late_monthly' || input.mode === 'late_waive'
  if (lateMode) {
    const lateDays = daysBetween(input.periodStart, input.returnDate)
    const chargedAmountCents = input.mode === 'late_waive' ? 0 : input.mode === 'late_monthly' ? Math.ceil(lateDays / 30) * fullAmountCents : Math.round(fullAmountCents * lateDays / 30)
    return { fullAmountCents, chargedAmountCents, adjustmentCents: 0, usedDays: 0, lateDays }
  }
  const usedDays = Math.max(1, daysBetween(input.periodStart, input.returnDate) + 1)
  const chargedAmountCents = input.mode === 'full_month' ? fullAmountCents : input.mode === 'waive' ? 0 : Math.min(fullAmountCents, Math.round(fullAmountCents * usedDays / 30))
  return { fullAmountCents, chargedAmountCents, adjustmentCents: fullAmountCents - chargedAmountCents, usedDays }
}

export function remainingQuantityAsOf(itemQuantity: number, itemId: number, periodStart: string, disposals: RentalDisposal[]) {
  const disposed = disposals
    .filter((row) => row.rentalItemId === itemId && row.date <= periodStart)
    .reduce((sum, row) => sum + row.quantity, 0)
  return Math.max(0, itemQuantity - disposed)
}

export type ReturnBill = {
  id: number
  periodStart: string
  periodEnd: string
  amount: string
  paidAmount: string
  billType: string
}

export function recalculateBillsAfterReturn(input: {
  bills: ReturnBill[]
  monthlyRent: string
  returnedQuantity: number
  returnDate: string
  currentAdjustmentCents?: number
}) {
  const futureReductionCents = toCents(input.monthlyRent) * input.returnedQuantity
  const currentBill = input.bills
    .filter(
      (bill) =>
        (bill.billType === '租金' || bill.billType === '逾期续租租金') &&
        bill.periodStart <= input.returnDate &&
        bill.periodEnd >= input.returnDate &&
        toCents(bill.amount) > toCents(bill.paidAmount),
    )
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0]

  return input.bills
    .filter(
      (bill) =>
        (bill.billType === '租金' || bill.billType === '逾期续租租金') &&
        (bill.id === currentBill?.id || bill.periodStart > input.returnDate),
    )
    .map((bill) => {
      const previousAmountCents = toCents(bill.amount)
      const reductionCents =
        bill.id === currentBill?.id
          ? Math.max(0, input.currentAdjustmentCents ?? 0)
          : futureReductionCents
      const nextAmountCents = Math.max(
        toCents(bill.paidAmount),
        previousAmountCents - reductionCents,
      )
      return {
        id: bill.id,
        previousAmountCents,
        nextAmountCents,
        reductionCents: previousAmountCents - nextAmountCents,
      }
    })
    .filter((bill) => bill.reductionCents > 0)
}

export function recalculateBillsAfterDispositions(input: {
  bills: ReturnBill[]
  dispositions: Array<{
    monthlyRent: string
    quantity: number
    date: string
    currentAdjustmentCents: number
  }>
}) {
  const requestedByBill = new Map<number, number>()
  for (const disposition of input.dispositions) {
    for (const adjustment of recalculateBillsAfterReturn({
      bills: input.bills,
      monthlyRent: disposition.monthlyRent,
      returnedQuantity: disposition.quantity,
      returnDate: disposition.date,
      currentAdjustmentCents: disposition.currentAdjustmentCents,
    })) {
      requestedByBill.set(
        adjustment.id,
        (requestedByBill.get(adjustment.id) ?? 0) + adjustment.reductionCents,
      )
    }
  }

  return input.bills.flatMap((bill) => {
    const requestedCents = requestedByBill.get(bill.id) ?? 0
    const previousAmountCents = toCents(bill.amount)
    const reducibleCents = Math.max(0, previousAmountCents - toCents(bill.paidAmount))
    const reductionCents = Math.min(requestedCents, reducibleCents)
    return reductionCents > 0
      ? [{
          id: bill.id,
          previousAmountCents,
          nextAmountCents: previousAmountCents - reductionCents,
          reductionCents,
        }]
      : []
  })
}
