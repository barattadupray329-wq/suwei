export function chinaDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function assertSameDayOfficialRental(createdAt: Date, now = new Date()) {
  if (chinaDate(createdAt) !== chinaDate(now)) {
    throw new Error('仅允许删除今天创建的录错正式订单')
  }
}

export function assertNoRentalActivity(activityCounts: readonly number[]) {
  if (activityCounts.some((count) => count > 0)) {
    throw new Error('该订单已有收款或后续业务记录，不能删除；请按正常业务流程处理')
  }
}

type InitialPayment = {
  id: number
  feeType: string
  notes: string | null
  renewalRecordId: number | null
  buyoutRecordId: number | null
  returnRecordId: number | null
  lossRecordId: number | null
}

export function assertOnlyInitialRentalPayments(
  payments: readonly InitialPayment[],
  allocationPaymentIds: readonly number[],
  ledgerPaymentIds: readonly (number | null)[],
  discountCount: number,
) {
  if (discountCount > 0) throw new Error('该合同已有收款优惠，不能按重复合同撤销')
  if (payments.length > 2) throw new Error('该合同已有额外收款，不能按重复合同撤销')
  const paymentIds = new Set(payments.map((payment) => payment.id))
  const feeTypes = new Set<string>()
  for (const payment of payments) {
    const isInitial =
      ['原合同租金', '押金'].includes(payment.feeType) &&
      payment.notes === `创建正式合同时即时收取${payment.feeType === '押金' ? '押金' : '租金'}` &&
      !payment.renewalRecordId && !payment.buyoutRecordId && !payment.returnRecordId && !payment.lossRecordId
    if (!isInitial || feeTypes.has(payment.feeType)) throw new Error('该合同已有非创建阶段收款，不能按重复合同撤销')
    feeTypes.add(payment.feeType)
  }
  if (allocationPaymentIds.some((id) => !paymentIds.has(id)) || ledgerPaymentIds.some((id) => id === null || !paymentIds.has(id))) {
    throw new Error('该合同已有额外账务流水，不能按重复合同撤销')
  }
}
