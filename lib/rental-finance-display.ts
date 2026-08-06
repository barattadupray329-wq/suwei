import { toCents } from './rental-calculations'

export type FinanceBill = {
  id: number
  amount: string | number
  paidAmount: string | number
  dueDate: string
  allocations?: Array<{ paymentRecordId: number; amount: string | number }>
}

export type FinanceLedgerEntry = {
  entryType: string
  amount: string | number
  paymentRecordId?: number | null
}

const discountTypes = new Set(['收款优惠', '租金优惠', '优惠核销'])
const discountReversalTypes = new Set(['优惠冲正', '收款优惠冲正'])
const depositOutflowTypes = new Set(['押金退还', '押金抵扣欠租', '押金抵扣赔偿'])

export function rentFinanceSummary(input: {
  totalRent: string | number
  paidAmount: string | number
  rentBills: FinanceBill[]
  ledger: FinanceLedgerEntry[]
}) {
  const grossRentCents = input.rentBills.reduce((sum, bill) => sum + Math.max(0, toCents(bill.amount)), 0)
  const discountCents = Math.max(0, input.ledger.reduce((sum, entry) => {
    if (discountTypes.has(entry.entryType)) return sum + Math.abs(toCents(entry.amount))
    if (discountReversalTypes.has(entry.entryType)) return sum - Math.abs(toCents(entry.amount))
    return sum
  }, 0))
  const netReceivableCents = Math.max(0, toCents(input.totalRent))
  const cashReceivedCents = Math.max(0, toCents(input.paidAmount))
  const outstandingCents = Math.max(0, netReceivableCents - cashReceivedCents)
  const accountBalanceCents = Math.max(0, cashReceivedCents - netReceivableCents)

  const discountByPayment = new Map<number, number>()
  for (const entry of input.ledger) {
    const direction = discountTypes.has(entry.entryType) ? 1 : discountReversalTypes.has(entry.entryType) ? -1 : 0
    if (!direction) continue
    const amountCents = direction * Math.abs(toCents(entry.amount))
    if (entry.paymentRecordId) discountByPayment.set(entry.paymentRecordId, (discountByPayment.get(entry.paymentRecordId) ?? 0) + amountCents)
  }

  const assignedDiscountByBill = new Map<number, number>()
  const remainingDiscountByPayment = new Map(discountByPayment)
  for (const bill of [...input.rentBills].sort((left, right) => left.dueDate.localeCompare(right.dueDate))) {
    let assignedCents = 0
    for (const allocation of bill.allocations ?? []) {
      const remainingDiscount = Math.max(0, remainingDiscountByPayment.get(allocation.paymentRecordId) ?? 0)
      const discountForAllocation = Math.min(Math.max(0, toCents(allocation.amount)), remainingDiscount)
      assignedCents += discountForAllocation
      remainingDiscountByPayment.set(allocation.paymentRecordId, remainingDiscount - discountForAllocation)
    }
    if (assignedCents > 0) assignedDiscountByBill.set(bill.id, assignedCents)
  }
  const assignedDiscountCents = [...assignedDiscountByBill.values()].reduce((sum, amount) => sum + amount, 0)
  let fallbackDiscountCredit = Math.max(0, discountCents - assignedDiscountCents)
  const sortedBills = [...input.rentBills].sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.id - right.id)
  const fallbackDiscountByBill = new Map<number, number>()

  // 旧数据可能没有付款分配记录，但账单 paidAmount 仍是可信的结清依据。
  // 未关联到付款的优惠从最后结清的账单向前归属，避免把合同累计实收错误挪到最早到期的欠款。
  for (const bill of [...sortedBills].reverse()) {
    if (fallbackDiscountCredit <= 0 || bill.allocations?.length) continue
    const recordedSettlementCents = Math.min(Math.max(0, toCents(bill.amount)), Math.max(0, toCents(bill.paidAmount)))
    const fallbackDiscount = Math.min(recordedSettlementCents, fallbackDiscountCredit)
    if (fallbackDiscount > 0) fallbackDiscountByBill.set(bill.id, fallbackDiscount)
    fallbackDiscountCredit -= fallbackDiscount
  }

  const billSettlement = new Map<number, { cashCents: number; discountCents: number; outstandingCents: number }>()
  for (const bill of sortedBills) {
    const amountCents = Math.max(0, toCents(bill.amount))
    const allocatedSettlementCents = Math.max(0, (bill.allocations ?? []).reduce((sum, allocation) => sum + toCents(allocation.amount), 0))
    const recordedSettlementCents = Math.min(amountCents, Math.max(0, toCents(bill.paidAmount)))
    const settlementCents = bill.allocations?.length ? Math.min(amountCents, allocatedSettlementCents) : recordedSettlementCents
    const discountForBillCents = Math.min(settlementCents, (assignedDiscountByBill.get(bill.id) ?? 0) + (fallbackDiscountByBill.get(bill.id) ?? 0))
    billSettlement.set(bill.id, {
      cashCents: Math.max(0, settlementCents - discountForBillCents),
      discountCents: discountForBillCents,
      outstandingCents: Math.max(0, amountCents - settlementCents),
    })
  }

  return { grossRentCents, discountCents, netReceivableCents, cashReceivedCents, outstandingCents, accountBalanceCents, billSettlement }
}

export function depositFinanceSummary(input: { contractualDeposit: string | number; ledger: FinanceLedgerEntry[] }) {
  const collectedFromLedgerCents = input.ledger.reduce((sum, entry) => entry.entryType === '押金收取' ? sum + Math.abs(toCents(entry.amount)) : sum, 0)
  const collectedCents = collectedFromLedgerCents || Math.max(0, toCents(input.contractualDeposit))
  const returnedOrOffsetCents = input.ledger.reduce((sum, entry) => depositOutflowTypes.has(entry.entryType) ? sum + Math.abs(toCents(entry.amount)) : sum, 0)
  return {
    collectedCents,
    returnedOrOffsetCents,
    refundableCents: Math.max(0, collectedCents - returnedOrOffsetCents),
  }
}

export function isDepositLedgerEntry(entryType: string) {
  return entryType === '押金收取' || depositOutflowTypes.has(entryType)
}
