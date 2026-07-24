export type AllocationBill = { id: number; amount: string | number; paidAmount: string | number; dueDate: string }
export type PaymentAllocation = { billId: number; amountCents: number; balanceAfterCents: number }

export const moneyToCents = (value: string | number) => Math.round(Number(value) * 100)
export const centsToMoney = (value: number) => (value / 100).toFixed(2)
export const billOutstandingCents = (bill: Pick<AllocationBill, 'amount' | 'paidAmount'>) => Math.max(0, moneyToCents(bill.amount) - moneyToCents(bill.paidAmount))

export function allocatePayment(bills: AllocationBill[], amount: string | number, targetBillId?: number) {
  let remaining = moneyToCents(amount)
  if (remaining <= 0) return []
  const eligible = [...bills]
    .filter(bill => targetBillId === undefined || bill.id === targetBillId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const allocations: PaymentAllocation[] = []
  for (const bill of eligible) {
    const outstanding = billOutstandingCents(bill)
    const amountCents = Math.min(remaining, outstanding)
    if (amountCents <= 0) continue
    allocations.push({ billId: bill.id, amountCents, balanceAfterCents: outstanding - amountCents })
    remaining -= amountCents
    if (remaining === 0) break
  }
  if (remaining > 0) throw new Error(`收款金额超过当前待收金额，最多可收 ${centsToMoney(moneyToCents(amount) - remaining)} 元`)
  return allocations
}
