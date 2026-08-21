import { moneyToCents } from './payment-allocation'
import { availableQuantity, type RentalItemQuantities } from './rental-lifecycle'

export type ReconciliationBill = { id?: number; amount: string | number; paidAmount: string | number; billType?: string; status?: string }
export type ReconciliationPayment = { amount: string | number; feeType?: string }
export type ReconciliationAllocation = { amount: string | number; billId?: number }

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
