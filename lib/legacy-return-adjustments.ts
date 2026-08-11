import { moneyToCents } from './payment-allocation'

export type LegacyReturnBill = {
  id: number
  periodStart: string
  periodEnd: string
  billType?: string
  amount: string | number
  paidAmount: string | number
}

const adjustmentTypes = new Set(['退租当期租金调整', '提前退租减免'])

/**
 * 兼容旧版退租记账：旧数据把“原应收”和“负数退租调整”拆成两笔。
 * 仅在同一账期内、金额可精确抵消且原账单未收款时核销，避免误伤真实欠款。
 */
export function settleLegacyReturnAdjustments<T extends LegacyReturnBill>(bills: T[]) {
  const adjustments = bills.filter(
    (bill) => adjustmentTypes.has(bill.billType ?? '') && moneyToCents(bill.amount) < 0,
  )
  const consumedAdjustments = new Set<number>()
  const settledBillIds = new Set<number>()

  for (const adjustment of adjustments) {
    const adjustmentCents = Math.abs(moneyToCents(adjustment.amount))
    const candidates = bills.filter(
      (bill) =>
        !adjustmentTypes.has(bill.billType ?? '') &&
        moneyToCents(bill.amount) === adjustmentCents &&
        moneyToCents(bill.paidAmount) === 0 &&
        adjustment.periodStart <= bill.periodEnd &&
        adjustment.periodEnd >= bill.periodStart,
    )
    if (candidates.length !== 1) continue
    settledBillIds.add(candidates[0].id)
    consumedAdjustments.add(adjustment.id)
  }

  return bills
    .filter((bill) => !consumedAdjustments.has(bill.id))
    .map((bill) =>
      settledBillIds.has(bill.id)
        ? { ...bill, amount: '0.00', paidAmount: '0.00', status: '已调整' }
        : bill,
    )
}
