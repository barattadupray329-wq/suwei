export const START_DATE_REASONS = ['旧数据转移', '客户要求', '补录'] as const

export type StartDateReason = (typeof START_DATE_REASONS)[number]

export function shanghaiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function normalizeStartDateReason(startDate: string, reason?: string | null, now = new Date()) {
  if (startDate === shanghaiToday(now)) return null
  if (!START_DATE_REASONS.includes(reason as StartDateReason)) {
    throw new Error('非当天起租必须选择原因')
  }
  return reason as StartDateReason
}

export function normalizeDeviceName(deviceType: string, deviceName?: string) {
  if (deviceType === '台式机') return '台式机'
  return deviceName?.trim() ?? ''
}

export function validateRentalItemFields(item: {
  deviceType: string
  deviceName?: string
  screenSize?: string
  quantity: number
  monthlyRent: number
}) {
  if (item.quantity < 1 || item.monthlyRent <= 0) return '请确保数量不少于 1，且租金单价大于 0'
  if (item.deviceType === '显示器' && (!item.deviceName?.trim() || !item.screenSize?.trim())) return '显示器必须填写品牌和屏幕尺寸'
  if (item.deviceType !== '台式机' && item.deviceType !== '显示器' && !item.deviceName?.trim()) return '请填写设备名称或型号'
  return ''
}
