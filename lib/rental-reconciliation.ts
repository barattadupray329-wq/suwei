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

const TERMINAL_ADJUSTMENT_STATUSES = new Set(['已调整', '已减免', '已取消'])

export function isDepositType(value?: string) {
  return value === '押金'
}

export function normalizedBillStatus(amount: string | number, paidAmount: string | number, currentStatus?: string) {
  if (currentStatus && TERMINAL_ADJUSTMENT_STATUSES.has(currentStatus)) return currentStatus
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
  return bills.reduce((sum, bill) => sum + Math.max(0, moneyToCents(bill.amount) - moneyToCents(bill.paidAmount)), 0)
}

export function billsReceivableCents(bills: ReconciliationBill[]) {
  return bills
    .filter((bill) => !isDepositType(bill.billType))
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
