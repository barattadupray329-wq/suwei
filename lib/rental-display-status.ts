import { isOpenBill, unallocatedRentCreditCents } from "./rental-reconciliation"
import { moneyToCents } from "./payment-allocation"

const terminalStatuses = new Set(["买断", "已退租", "已结束", "已关闭", "丢失"])

export type RentalStatusInput = {
  endDate: string
  status: string
  // 合同总已收（元）。用于扣除账户余额/减免形成的信用额度——已被余额顶掉的账单不再算逾期。
  paidAmount?: string | number
  bills: Array<{
    dueDate: string
    amount: string | number
    paidAmount: string | number
    billType?: string
    status?: string
  }>
}

export function rentalOverdueAmount(rental: RentalStatusInput, today: string) {
  const grossOverdueCents = rental.bills
    .filter((bill) => bill.dueDate <= today && isOpenBill(bill))
    .reduce((sum, bill) => sum + Math.max(0, moneyToCents(bill.amount) - moneyToCents(bill.paidAmount)), 0)
  // 信用额度按到期日从早到晚抵扣，逾期账单最紧迫、会被优先顶掉，因此逾期净额 = 逾期裸额 − 信用额度。
  const creditCents = unallocatedRentCreditCents(rental.bills, moneyToCents(rental.paidAmount ?? 0))
  return Math.max(0, grossOverdueCents - creditCents) / 100
}

export function isContractExpired(rental: RentalStatusInput, today: string) {
  return rental.endDate < today && !terminalStatuses.has(rental.status)
}

export function rentalDisplayStatus(rental: RentalStatusInput, today: string) {
  if (!isContractExpired(rental, today)) return rental.status
  return rentalOverdueAmount(rental, today) > 0 ? "逾期" : "已到期"
}
