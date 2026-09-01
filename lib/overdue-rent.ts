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

export type RenewalPeriodInput = { periodStart: string; periodEnd: string; amountCents: number }
export type OverdueBillForMatch = { id: number; billType: string; periodStart: string; periodEnd: string; paidAmountCents: number }
export type RenewalPeriodPlan = {
  periodStart: string
  periodEnd: string
  amountCents: number
  /** 命中的已存在"逾期续租租金"账单 id；null 表示这一期需要新建账单。 */
  absorbBillId: number | null
  /** 命中账单已收的钱（分）。本期"还需再收"= max(0, amountCents - paidAmountCents)。 */
  paidAmountCents: number
}

/**
 * 合同到期后系统会按月自动生成"逾期续租租金"账单（见 overdueRentPeriods / lib/overdue-rent-billing）。
 * 用户随后办理续租时，如果续租的月份和这些账单落在同一个自然月，就会被计费两次（一条逾期租金 + 一条续租费）。
 *
 * 本函数把每一期续租账期去和"尚存的逾期续租租金账单"做区间重叠匹配：
 * - 命中：吸收该逾期账单（保留其 id 与已收金额，后续把它改写成续租费），absorbBillId 指向它；
 * - 未命中：这一期照常新建账单，absorbBillId 为 null。
 *
 * 判定重叠用半开区间 [periodStart, periodEnd) 相交：续租期 periodEnd 是"含尾"的最后一天，
 * 逾期账单 periodEnd 是"不含"的下月同日，为统一比较，这里两侧都视作"起始日落在对方自然月内即算命中"，
 * 具体用 periodStart 落点判断：只要某逾期账单的 periodStart 落在续租期 [start, end] 内，或续租期 periodStart
 * 落在逾期账单 [start, end) 内，即视为同一个月、需要吸收。每条逾期账单最多被一期续租吸收一次。
 */
export function matchRenewalPeriodsToOverdueBills(
  periods: RenewalPeriodInput[],
  overdueBills: OverdueBillForMatch[],
): RenewalPeriodPlan[] {
  // 只考虑"逾期续租租金"类账单（billType 含"续租租金"），按 periodStart 升序，保证匹配稳定、可预期。
  const candidates = overdueBills
    .filter((bill) => bill.billType.includes('续租租金'))
    .sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : a.id - b.id))
  const usedBillIds = new Set<number>()

  return periods.map((period) => {
    const hit = candidates.find((bill) => {
      if (usedBillIds.has(bill.id)) return false
      // 区间重叠：两段自然月只要起始日互相落在对方区间内就算同一期（避免"含尾/不含尾"边界误差）。
      const billInPeriod = bill.periodStart >= period.periodStart && bill.periodStart <= period.periodEnd
      const periodInBill = period.periodStart >= bill.periodStart && period.periodStart < bill.periodEnd
      return billInPeriod || periodInBill
    })
    if (hit) usedBillIds.add(hit.id)
    return {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amountCents: period.amountCents,
      absorbBillId: hit ? hit.id : null,
      paidAmountCents: hit ? hit.paidAmountCents : 0,
    }
  })
}
