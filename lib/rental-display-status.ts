const terminalStatuses = new Set(["买断", "已买断", "已退租", "已退回", "已结束", "已完成", "已关闭", "丢失", "已丢失"])

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
  if (terminalStatuses.has(rental.status)) return rental.status
  if (rental.endDate < today) return "逾期"
  if (rental.endDate === today) return "到期"
  return rental.status
}
