export type ReturnRentMode = 'full_month' | 'daily' | 'waive'
export type UnpaidPeriodMode = 'waive' | 'daily' | 'amount'

export type UnpaidPeriodBill = { id: number; periodStart: string; periodEnd: string; amountCents: number; paidCents: number }

// 退租时对勾选的未付款账期，只处理退还设备在这些账期里的那部分租金：
// waive 不收任何费用；daily 按已用天数收；amount 按约定总额从最早一期开始分摊。
// 减免只减未收部分，不会把已收金额变成退款。
export function planUnpaidPeriodSettlement(input: {
  bills: UnpaidPeriodBill[]
  returnedMonthlyCents: number
  returnDate: string
  mode: UnpaidPeriodMode
  amountCents?: number
}) {
  let remainingAmount = Math.max(0, Math.round(input.amountCents ?? 0))
  const rows = [...input.bills]
    .sort((left, right) => left.periodStart.localeCompare(right.periodStart))
    .map((bill) => {
      const periodDays = Math.max(1, Math.round((Date.parse(`${bill.periodEnd}T00:00:00+08:00`) - Date.parse(`${bill.periodStart}T00:00:00+08:00`)) / DAY_MS))
      const months = Math.max(1, Math.round(periodDays / 30))
      const totalDays = months * 30
      const shareCents = Math.max(0, Math.min(bill.amountCents, input.returnedMonthlyCents * months))
      const remainingDays = Math.max(0, Math.ceil((Date.parse(`${bill.periodEnd}T00:00:00+08:00`) - Date.parse(`${input.returnDate}T00:00:00+08:00`)) / DAY_MS))
      const usedDays = Math.max(0, Math.min(totalDays, totalDays - remainingDays))
      let plannedCharge = 0
      if (input.mode === 'daily') plannedCharge = Math.min(shareCents, Math.round(shareCents * usedDays / totalDays))
      if (input.mode === 'amount') { plannedCharge = Math.min(shareCents, remainingAmount); remainingAmount -= plannedCharge }
      const unpaidCents = Math.max(0, bill.amountCents - bill.paidCents)
      const reductionCents = Math.min(shareCents - plannedCharge, unpaidCents)
      return { id: bill.id, periodStart: bill.periodStart, periodEnd: bill.periodEnd, shareCents, usedDays, totalDays, chargeCents: shareCents - reductionCents, reductionCents }
    })
  const totalShareCents = rows.reduce((sum, row) => sum + row.shareCents, 0)
  return {
    rows,
    totalShareCents,
    totalChargeCents: rows.reduce((sum, row) => sum + row.chargeCents, 0),
    totalReductionCents: rows.reduce((sum, row) => sum + row.reductionCents, 0),
    amountExceedsShare: input.mode === 'amount' && Math.round(input.amountCents ?? 0) > totalShareCents,
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
  // 退租日不重复计入已用天数：5/18 至 6/14 退租，剩余 6/14 至 6/18 为 4 天。
  const elapsed = Math.ceil((Date.parse(`${input.returnDate}T00:00:00+08:00`) - Date.parse(`${input.periodStart}T00:00:00+08:00`)) / DAY_MS)
  const usedDays = Math.max(0, Math.min(30, elapsed))
  const remainingDays = Math.max(0, Math.ceil((Date.parse(`${input.periodEnd}T00:00:00+08:00`) - Date.parse(`${input.returnDate}T00:00:00+08:00`)) / DAY_MS))
  const full = cents(Math.max(0, input.fullAmount))
  const collected = Math.min(full, cents(Math.max(0, input.collectedAmount)))
  // 整期收取只保留本期原状：不退款，也不追收未收部分。
  // 退本期全额只退本期实际已收租金，不能把未收金额当成退款。
  const charge = input.mode === 'full_month' ? collected : input.mode === 'daily' ? Math.min(full, Math.round(full * usedDays / 30)) : 0
  const refund = input.mode === 'waive' ? collected : input.mode === 'daily' ? Math.max(0, collected - charge) : 0
  return {
    usedDays,
    remainingDays,
    dailyAmount: full / 30 / 100,
    chargeAmount: charge / 100,
    refundAmount: refund / 100,
    collectAmount: 0,
    adjustmentAmount: input.mode === 'waive' || input.mode === 'daily' ? Math.max(0, collected - charge) / 100 : 0,
  }
}
