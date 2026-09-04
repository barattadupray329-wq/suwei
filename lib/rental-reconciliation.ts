import { moneyToCents } from './payment-allocation'
import { availableQuantity, type RentalItemQuantities } from './rental-lifecycle'

export type ReconciliationBill = { id?: number; amount: string | number; paidAmount: string | number; billType?: string; status?: string }
export type ReconciliationPayment = { id?: number; amount: string | number; feeType?: string }
export type ReconciliationAllocation = { amount: string | number; billId?: number; paymentRecordId?: number }
export type ReversalLedgerEntry = { paymentRecordId?: number | null }

export function reversedPaymentIds(entries: ReversalLedgerEntry[]) {
  return new Set(entries.flatMap((entry) => entry.paymentRecordId == null ? [] : [entry.paymentRecordId]))
}

export function activePositivePayments<T extends ReconciliationPayment & { id: number }>(payments: T[], ledger: ReversalLedgerEntry[]) {
  const reversedIds = reversedPaymentIds(ledger)
  return payments.filter((payment) => moneyToCents(payment.amount) > 0 && !reversedIds.has(payment.id))
}

export function reversedBillPaidCents(currentPaid: string | number, allocations: ReconciliationAllocation[]) {
  const currentCents = moneyToCents(currentPaid)
  const reversalCents = allocationTotalCents(allocations)
  if (reversalCents <= 0) throw new Error('原收款缺少有效的账单分配，禁止冲正')
  if (reversalCents > currentCents) throw new Error(`账单已收小于待冲正分配：${currentCents} < ${reversalCents}`)
  return currentCents - reversalCents
}

export function reversedContractAmounts(input: {
  total: string | number
  paid: string | number
  payments: ReconciliationPayment[]
  discountAmount?: string | number
}) {
  const reversedPaid = nonDepositPaymentCents(input.payments)
  const discountCents = moneyToCents(input.discountAmount ?? 0)
  const totalCents = moneyToCents(input.total) + discountCents
  const paidCents = moneyToCents(input.paid) - reversedPaid
  if (reversedPaid < 0 || discountCents < 0) throw new Error('冲正金额不能为负数')
  if (paidCents < 0) throw new Error('合同已收小于待冲正收款，禁止冲正')
  if (totalCents < paidCents) throw new Error('冲正后合同应收不能小于合同已收')
  return { totalCents, paidCents, paymentStatus: paymentStatusFromCents(totalCents, paidCents) }
}

export const TERMINAL_BILL_STATUSES = new Set(['已结清', '已冲正', '已减免', '已抵扣', '已调整', '已取消'])
// 与 TERMINAL_BILL_STATUSES 的区别：不含「已结清」——已结清代表正常付清的真实账期，
// 期数展示（已付/未付/合计）必须把它计入，只有冲正/减免/抵扣/调整/取消这些「作废或非真实账期」的账单才应被剔除。
export const PRESERVED_BILL_STATUSES = new Set(['已冲正', '已减免', '已抵扣', '已调整', '已取消'])

export function isDepositType(value?: string) {
  return value === '押金'
}

export function isOpenBill(bill: Pick<ReconciliationBill, 'amount' | 'paidAmount' | 'status'>) {
  if (bill.status && TERMINAL_BILL_STATUSES.has(bill.status)) return false
  return moneyToCents(bill.amount) > moneyToCents(bill.paidAmount)
}

export function isOpenRentBill(bill: ReconciliationBill) {
  return !isDepositType(bill.billType) && isOpenBill(bill)
}

export function billOutstandingStrictCents(bill: Pick<ReconciliationBill, 'amount' | 'paidAmount' | 'status'>) {
  if (!isOpenBill(bill)) return 0
  const outstanding = moneyToCents(bill.amount) - moneyToCents(bill.paidAmount)
  if (outstanding <= 0) throw new Error('开放账单金额异常')
  return outstanding
}

export function rentOutstandingCents(bills: ReconciliationBill[]) {
  return bills.filter(isOpenRentBill).reduce((sum, bill) => sum + billOutstandingStrictCents(bill), 0)
}

export function rentOverdueCents(bills: Array<ReconciliationBill & { dueDate: string }>, today: string) {
  return bills.filter((bill) => isOpenRentBill(bill) && bill.dueDate <= today).reduce((sum, bill) => sum + billOutstandingStrictCents(bill), 0)
}

// 合同层面尚未落到具体账单「已收」上的信用额度：多收的现金（合同总已收超过各期账单已收之和）
// 加上未摊派到某一期账单的减免/调整（负数账单）。这笔额度在业务上等同于「账户余额」，
// 应当用来抵扣仍开放的租金账单——与详情页 DetailFinance 卡片里「已抵扣 / 账户余额」的口径一致。
// 不这样处理时，逐期裸算的待收/逾期会把这些其实已被余额顶掉的账单重复算成欠款。
export function unallocatedRentCreditCents(
  bills: Array<Pick<ReconciliationBill, 'amount' | 'paidAmount' | 'billType' | 'status'>>,
  contractPaidCents: number,
) {
  let recordedRentPaidCents = 0
  let discountCents = 0
  for (const bill of bills) {
    if (isDepositType(bill.billType)) continue
    const amountCents = moneyToCents(bill.amount)
    if (amountCents > 0) recordedRentPaidCents += moneyToCents(bill.paidAmount)
    else if (amountCents < 0) discountCents += -amountCents
  }
  return Math.max(0, contractPaidCents + discountCents - recordedRentPaidCents)
}

// 对每一张仍开放的租金账单，返回抵扣信用额度后真正欠缴的金额（分）。信用额度按到期日
// 从早到晚填充（最紧迫的欠款先被余额顶掉），因此逾期账单会优先被抵扣——与收款分配顺序一致。
export function effectiveRentOutstandingByBill<
  T extends ReconciliationBill & { dueDate?: string },
>(bills: T[], contractPaidCents: number) {
  let credit = unallocatedRentCreditCents(bills, contractPaidCents)
  const openRentBills = bills
    .filter((bill) => isOpenRentBill(bill))
    .sort((left, right) => String(left.dueDate ?? '').localeCompare(String(right.dueDate ?? '')))
  const result = new Map<T, number>()
  for (const bill of openRentBills) {
    const gapCents = Math.max(0, moneyToCents(bill.amount) - moneyToCents(bill.paidAmount))
    const settledCents = Math.min(gapCents, credit)
    credit -= settledCents
    result.set(bill, gapCents - settledCents)
  }
  return result
}

export function rentOutstandingAfterCreditCents(
  bills: ReconciliationBill[],
  contractPaidCents: number,
) {
  return Math.max(0, rentOutstandingCents(bills) - unallocatedRentCreditCents(bills, contractPaidCents))
}

export function rentOverdueAfterCreditCents(
  bills: Array<ReconciliationBill & { dueDate: string }>,
  today: string,
  contractPaidCents: number,
) {
  return Math.max(0, rentOverdueCents(bills, today) - unallocatedRentCreditCents(bills, contractPaidCents))
}

export function normalizedBillStatus(amount: string | number, paidAmount: string | number, currentStatus?: string) {
  if (currentStatus && PRESERVED_BILL_STATUSES.has(currentStatus)) return currentStatus
  const amountCents = moneyToCents(amount)
  const paidCents = moneyToCents(paidAmount)
  if (amountCents <= 0 || paidCents >= amountCents) return '已结清' as const
  if (paidCents > 0) return '部分收款' as const
  return '待收款' as const
}

export function contractAvailableQuantity(items: RentalItemQuantities[]) {
  return items.reduce((sum, item) => sum + availableQuantity(item), 0)
}

export function billsOutstandingCents(bills: ReconciliationBill[]) {
  return bills.reduce((sum, bill) => sum + billOutstandingStrictCents(bill), 0)
}

export function billsReceivableCents(bills: ReconciliationBill[]) {
  return bills
    .filter((bill) => !isDepositType(bill.billType) && !bill.status?.match(/^(已冲正|已减免|已抵扣|已取消)$/))
    .reduce((sum, bill) => sum + moneyToCents(bill.amount), 0)
}

export function nonDepositPaymentCents(payments: ReconciliationPayment[]) {
  return payments.filter((payment) => !isDepositType(payment.feeType)).reduce((sum, payment) => sum + moneyToCents(payment.amount), 0)
}

export function allocationTotalCents(allocations: ReconciliationAllocation[]) {
  return allocations.reduce((sum, allocation) => sum + moneyToCents(allocation.amount), 0)
}

export function paymentStatusFromCents(receivableCents: number, paidCents: number) {
  if (receivableCents <= 0 || paidCents >= receivableCents) return '已结清' as const
  if (paidCents > 0) return '部分收款' as const
  return '待收款' as const
}

export function assertFinancialReconciliation(input: {
  contractTotal: string | number
  contractPaid: string | number
  bills: ReconciliationBill[]
  payments: ReconciliationPayment[]
  allocations?: ReconciliationAllocation[]
}) {
  const contractTotalCents = moneyToCents(input.contractTotal)
  const contractPaidCents = moneyToCents(input.contractPaid)
  const billTotalCents = billsReceivableCents(input.bills)
  const paymentTotalCents = nonDepositPaymentCents(input.payments)
  if (contractTotalCents !== billTotalCents) throw new Error(`合同应收与账单应收不一致：${contractTotalCents} != ${billTotalCents}`)
  if (contractPaidCents !== paymentTotalCents) throw new Error(`合同已收与有效收款不一致：${contractPaidCents} != ${paymentTotalCents}`)
  if (input.allocations && allocationTotalCents(input.allocations) !== paymentTotalCents) throw new Error('付款分配与有效收款不一致')
  return true
}
