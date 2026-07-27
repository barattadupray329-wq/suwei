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
