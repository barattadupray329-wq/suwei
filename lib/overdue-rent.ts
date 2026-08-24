import { addCalendarDays, addCalendarMonths, toCents } from './rental-calculations'

export type RentalDisposal = { rentalItemId: number; quantity: number; date: string }
export type ReturnBillingMode = 'full_month' | 'daily' | 'waive'
export type RentBillBalance = { id: number; billType: string; amount: string; paidAmount: string; notes?: string | null }

export function isRentBillType(billType: string) {
  return billType === '租金'
    || billType === '起租预收'
    || billType === '日租租金'
    || billType === '续租费'
    || billType.includes('续租租金')
}

export function fullReturnWaiver(bills: RentBillBalance[]) {
  const affected = bills.filter((bill) => isRentBillType(bill.billType) && toCents(bill.amount) > toCents(bill.paidAmount))
  return {
    affected,
    adjustmentCents: affected.reduce((sum, bill) => sum + toCents(bill.amount) - toCents(bill.paidAmount), 0),
  }
}

export function overdueRentPeriods(endDate: string, today: string) {
  const periods: Array<{ periodStart: string; periodEnd: string }> = []
  // 合同 endDate 是最后一个已覆盖的自然日，续租账期必须从次日开始，避免重叠计费。
  let periodStart = addCalendarDays(endDate, 1)
  while (periodStart <= today) {
    const periodEnd = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd })
    periodStart = periodEnd
  }
  return periods
}

export function monthlyRentPeriod(startDate: string, endDate: string, targetDate: string) {
  if (targetDate < startDate) return undefined

  if (targetDate <= endDate) {
    let periodStart = startDate
    let periodEnd = addCalendarMonths(periodStart, 1)
    while (periodEnd <= targetDate) {
      periodStart = periodEnd
      periodEnd = addCalendarMonths(periodStart, 1)
    }
    return { periodStart, periodEnd }
  }

  return overdueRentPeriods(endDate, targetDate).at(-1)
}

export function returnBillingAdjustment(input: { periodStart: string; periodEnd: string; returnDate: string; monthlyRent: string; quantity: number; mode: ReturnBillingMode }) {
  const fullAmountCents = toCents(input.monthlyRent) * input.quantity
  // 退租日当天不再计租：5/18–6/18，6/14退租，退 6/14–6/18 共4天，因此按26天收取。
  const remainingDays = Math.max(0, Math.ceil((Date.parse(`${input.periodEnd}T00:00:00+08:00`) - Date.parse(`${input.returnDate}T00:00:00+08:00`)) / 86_400_000))
  const usedDays = Math.max(0, Math.min(30, 30 - remainingDays))
  // 整期收取不改变本期账单：不退、不补；按天才按已用天数重算。
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

export type UnpaidRentBillCandidate = { id: number; billType: string; amount: string; paidAmount: string; periodStart: string; notes?: string | null }

/**
 * 退租/丢失/买断后，尚未收款的未来月租账单按各设备明细当时的剩余数量重算。
 * `disposals` 必须是该合同全部历史处置记录（退租+丢失+买断）叠加本次操作，
 * 否则第二次及以后的处置会漏算之前已发生的处置，导致未来账单金额算多。
 * `effectiveDate` 通常取本次操作批次里最晚的处置日期：早于它开始的账期视为已按原数量结清，不追溯调整。
 */
export function recomputeUnpaidRentBills(
  items: Array<{ id: number; quantity: number; monthlyRent: string }>,
  bills: UnpaidRentBillCandidate[],
  disposals: RentalDisposal[],
  effectiveDate: string,
  excludeBillIds: Set<number> = new Set(),
) {
  return bills
    .filter((bill) => isRentBillType(bill.billType) && toCents(bill.paidAmount) === 0 && bill.periodStart >= effectiveDate && !excludeBillIds.has(bill.id))
    .map((bill) => {
      const currentCents = toCents(bill.amount)
      const nextAmountCents = items.reduce((sum, item) => sum + toCents(item.monthlyRent) * remainingQuantityAsOf(item.quantity, item.id, bill.periodStart, disposals), 0)
      return { bill, nextAmountCents, reductionCents: Math.max(0, currentCents - nextAmountCents) }
    })
    .filter((entry) => entry.nextAmountCents !== toCents(entry.bill.amount))
}
