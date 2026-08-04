import { addCalendarMonths, toCents } from './rental-calculations'

export type RentalDisposal = { rentalItemId: number; quantity: number; date: string }
export type ReturnBillingMode = 'full_month' | 'daily' | 'waive'

export function overdueRentPeriods(endDate: string, today: string) {
  const periods: Array<{ periodStart: string; periodEnd: string }> = []
  let periodStart = endDate
  while (periodStart < today) {
    const periodEnd = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd })
    periodStart = periodEnd
  }
  return periods
}

export function returnBillingAdjustment(input: { periodStart: string; returnDate: string; monthlyRent: string; quantity: number; mode: ReturnBillingMode }) {
  const fullAmountCents = toCents(input.monthlyRent) * input.quantity
  const usedDays = Math.max(1, Math.ceil((Date.parse(`${input.returnDate}T00:00:00+08:00`) - Date.parse(`${input.periodStart}T00:00:00+08:00`)) / 86_400_000) + 1)
  const chargedAmountCents = input.mode === 'full_month'
    ? fullAmountCents
    : input.mode === 'waive'
      ? 0
      : Math.min(fullAmountCents, Math.round(fullAmountCents * usedDays / 30))
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
}) {
  const reductionCents = toCents(input.monthlyRent) * input.returnedQuantity
  return input.bills
    .filter((bill) => bill.billType === '租金' && bill.periodEnd > input.returnDate)
    .map((bill) => {
      const previousAmountCents = toCents(bill.amount)
      const nextAmountCents = Math.max(toCents(bill.paidAmount), previousAmountCents - reductionCents)
      return {
        id: bill.id,
        previousAmountCents,
        nextAmountCents,
        reductionCents: previousAmountCents - nextAmountCents,
      }
    })
    .filter((bill) => bill.reductionCents > 0)
}
