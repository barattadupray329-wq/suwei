export function chinaDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export const OFFICIAL_DELETE_WINDOW_DAYS = 7

// 正式合同录错后，允许在“录单时间”起 N 天内删除。判定以记录创建时间（createdAt，即录单时间）
// 为准，而不是起租日期——两者常常不同。删除会连带撤销该单的续租/退租/买断/报损/维修/变更
// 及其收款与账务，因此不再限制“无后续业务记录”。
export function assertOfficialRentalDeletable(
  createdAt: Date,
  now: Date = new Date(),
  windowDays: number = OFFICIAL_DELETE_WINDOW_DAYS,
) {
  const ageMs = now.getTime() - createdAt.getTime()
  if (ageMs > windowDays * 24 * 60 * 60 * 1000) {
    throw new Error(`只能删除录单后 ${windowDays} 天内的正式订单；超过 ${windowDays} 天请按正常退租或关闭流程处理`)
  }
}
