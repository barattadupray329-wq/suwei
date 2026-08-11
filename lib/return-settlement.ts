import { billingPeriodAt } from './billing-periods'
import { billPeriodRanges, toCents } from './rental-calculations'

export type ReturnRentMode = 'full_month' | 'daily' | 'waive'
export type ReturnSettlementBill = {
  id: number
  periodStart: string
  periodEnd: string
  amount: string | number
  paidAmount: string | number
  billType: string
}

export function returnPeriodSettlement(input: { anchorDate: string; returnDate: string; bills: ReturnSettlementBill[] }) {
  const currentPeriod = billingPeriodAt(input.anchorDate, input.returnDate)
  const rentBills = input.bills.filter((bill) => bill.billType !== '押金' && toCents(bill.amount) > 0)
  const { ranges } = billPeriodRanges(rentBills, { anchorDate: input.anchorDate })
  let currentSettled = false
  let historicalUnpaidPeriods = 0
  let historicalOutstandingCents = 0

  for (const bill of rentBills) {
    const range = ranges.get(bill.id)
    if (!range) continue
    const amountCents = toCents(bill.amount)
    const paidCents = Math.min(amountCents, toCents(bill.paidAmount))
    const periodAmountCents = amountCents / range.span
    const paidPeriods = periodAmountCents > 0 ? Math.min(range.span, Math.floor((paidCents + 0.5) / periodAmountCents)) : 0
    for (let periodNo = range.start; periodNo <= range.end; periodNo += 1) {
      const settled = periodNo - range.start < paidPeriods
      if (periodNo === currentPeriod.periodNo && settled) currentSettled = true
      if (periodNo < currentPeriod.periodNo && !settled) {
        historicalUnpaidPeriods += 1
        historicalOutstandingCents += Math.round(periodAmountCents)
      }
    }
  }

  return {
    currentPeriod,
    currentSettled,
    historicalUnpaidPeriods,
    historicalOutstanding: historicalOutstandingCents / 100,
  }
}

const DAY_MS = 86_400_000
const cents = (value: number) => Math.round(value * 100)

export function calculateReturnRent(input: {
  periodStart: string
  periodEnd: string
  returnDate: string
  fullAmount: number
  collectedAmount: number
  mode: ReturnRentMode
}) {
  const elapsed = Math.ceil((Date.parse(`${input.returnDate}T00:00:00+08:00`) - Date.parse(`${input.periodStart}T00:00:00+08:00`)) / DAY_MS) + 1
  const usedDays = Math.max(0, Math.min(30, elapsed))
  const remainingDays = Math.max(0, 30 - usedDays)
  const full = cents(Math.max(0, input.fullAmount))
  const collected = Math.min(full, cents(Math.max(0, input.collectedAmount)))
  const charge = input.mode === 'full_month' ? full : input.mode === 'daily' ? Math.min(full, Math.round(full * usedDays / 30)) : 0
  return {
    usedDays,
    remainingDays,
    dailyAmount: full / 30 / 100,
    chargeAmount: charge / 100,
    refundAmount: Math.max(0, Math.min(collected, collected - charge)) / 100,
    collectAmount: Math.max(0, charge - collected) / 100,
    adjustmentAmount: (full - charge) / 100,
  }
}
