const terminalStatuses = new Set(["买断", "已退租", "已结束", "已关闭", "丢失"])

export type RentalStatusInput = {
  endDate: string
  status: string
  bills: Array<{ dueDate: string; amount: string | number; paidAmount: string | number }>
}

export function rentalOverdueAmount(rental: RentalStatusInput, today: string) {
  return rental.bills
    .filter((bill) => bill.dueDate <= today)
    .reduce(
      (sum, bill) => sum + Math.max(0, Number(bill.amount) - Number(bill.paidAmount)),
      0,
    )
}

export function isContractExpired(rental: RentalStatusInput, today: string) {
  return rental.endDate < today && !terminalStatuses.has(rental.status)
}

export function rentalDisplayStatus(rental: RentalStatusInput, today: string) {
  if (!isContractExpired(rental, today)) return rental.status
  return rentalOverdueAmount(rental, today) > 0 ? "逾期" : "已到期"
}
