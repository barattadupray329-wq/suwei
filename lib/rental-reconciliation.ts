import { moneyToCents } from './payment-allocation'
import { availableQuantity, type RentalItemQuantities } from './rental-lifecycle'

export type ReconciliationBill = { id?: number; amount: string | number; paidAmount: string | number; billType?: string }
export type ReconciliationPayment = { id?: number; amount: string | number; feeType?: string }
export type ReconciliationAllocation = { paymentRecordId?: number; amount: string | number }
export type ReconciliationDiscount = { paymentRecordId: number; amount: string | number; reversedAt?: Date | string | null }

export type RentalFinancialSnapshot = {
  rentReceivableCents: number
  netReceivableCents: number
  cashReceivedCents: number
  effectiveDiscountCents: number
  allocatedSettlementCents: number
  outstandingCents: number
  depositReceivableCents: number
  depositReceivedCents: number
  unallocatedCashCents: number
  reconciliationDifferenceCents: number
}

export function rentalFinancialSnapshot(input: {
  bills: ReconciliationBill[]
  payments: ReconciliationPayment[]
  allocations?: ReconciliationAllocation[]
  discounts?: ReconciliationDiscount[]
  reversedPaymentIds?: number[]
}): RentalFinancialSnapshot {
  const allocations = input.allocations ?? []
  const discounts = input.discounts ?? []
  const reversedPaymentIds = new Set(input.reversedPaymentIds ?? [])
  const rentBills = input.bills.filter((bill) => bill.billType !== '押金')
  const depositBills = input.bills.filter((bill) => bill.billType === '押金')
  const rentPayments = input.payments.filter((payment) => payment.feeType !== '押金')
  const depositPayments = input.payments.filter((payment) => payment.feeType === '押金')
  const activeRentPaymentIds = new Set(rentPayments.flatMap((payment) => payment.id === undefined || moneyToCents(payment.amount) <= 0 || reversedPaymentIds.has(payment.id) ? [] : [payment.id]))
  const effectiveDiscountCents = discounts
    .filter((discount) => !discount.reversedAt && activeRentPaymentIds.has(discount.paymentRecordId))
    .reduce((sum, discount) => sum + Math.max(0, moneyToCents(discount.amount)), 0)
  const allocatedSettlementCents = allocations
    .filter((allocation) => allocation.paymentRecordId === undefined || activeRentPaymentIds.has(allocation.paymentRecordId))
    .reduce((sum, allocation) => sum + Math.max(0, moneyToCents(allocation.amount)), 0)
  const cashReceivedCents = nonDepositPaymentCents(input.payments)
  const rentReceivableCents = billsReceivableCents(input.bills)
  const netReceivableCents = rentReceivableCents - effectiveDiscountCents
  const expectedSettlementCents = cashReceivedCents + effectiveDiscountCents
  return {
    rentReceivableCents,
    netReceivableCents,
    cashReceivedCents,
    effectiveDiscountCents,
    allocatedSettlementCents,
    outstandingCents: billsOutstandingCents(rentBills),
    depositReceivableCents: depositBills.reduce((sum, bill) => sum + moneyToCents(bill.amount), 0),
    depositReceivedCents: depositPayments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0),
    unallocatedCashCents: Math.max(0, expectedSettlementCents - allocatedSettlementCents),
    reconciliationDifferenceCents: allocatedSettlementCents - expectedSettlementCents,
  }
}

export function contractAvailableQuantity(items: RentalItemQuantities[]) {
  return items.reduce((sum, item) => sum + availableQuantity(item), 0)
}

export function billsOutstandingCents(bills: ReconciliationBill[]) {
  return bills.reduce((sum, bill) => sum + Math.max(0, moneyToCents(bill.amount) - moneyToCents(bill.paidAmount)), 0)
}

export function billsReceivableCents(bills: ReconciliationBill[]) {
  return bills
    .filter((bill) => bill.billType !== '押金')
    .reduce((sum, bill) => sum + moneyToCents(bill.amount), 0)
}

export function nonDepositPaymentCents(payments: ReconciliationPayment[]) {
  return payments.filter(payment => payment.feeType !== '押金').reduce((sum, payment) => sum + moneyToCents(payment.amount), 0)
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
  discounts?: ReconciliationDiscount[]
  reversedPaymentIds?: number[]
}) {
  const contractTotalCents = moneyToCents(input.contractTotal)
  const contractPaidCents = moneyToCents(input.contractPaid)
  const snapshot = rentalFinancialSnapshot(input)
  if (contractTotalCents !== snapshot.netReceivableCents) throw new Error(`合同净应收与账单毛应收扣除有效优惠后不一致：${contractTotalCents} != ${snapshot.netReceivableCents}`)
  if (contractPaidCents !== snapshot.cashReceivedCents) throw new Error(`合同已收与有效收款不一致：${contractPaidCents} != ${snapshot.cashReceivedCents}`)
  if (input.allocations && snapshot.reconciliationDifferenceCents !== 0) throw new Error('账单核销必须等于真实现金与有效优惠之和')
  return true
}
