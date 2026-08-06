const terminalStatuses = new Set(["买断", "已退租", "已结束", "已关闭", "丢失"])

export type RentalStatusInput = {
  endDate: string
  status: string
  bills: Array<{ dueDate: string; amount: string | number; paidAmount: string | number; billType?: string }>
}

export function rentalOverdueAmount(rental: RentalStatusInput, today: string) {
  return rental.bills
    // 约定还款日当天不算逾期；押金和负数调整单也不计入租金逾期。
    .filter((bill) => bill.dueDate < today && bill.billType !== "押金" && Number(bill.amount) > 0)
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
