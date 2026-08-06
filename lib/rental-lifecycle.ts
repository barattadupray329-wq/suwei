export type RentalItemQuantities = {
  quantity: number
  boughtOutQuantity: number
  returnedQuantity: number
  lostQuantity: number
}

export function assertQuantityInvariant(item: RentalItemQuantities) {
  const values = [item.quantity, item.boughtOutQuantity, item.returnedQuantity, item.lostQuantity]
  if (values.some(value => !Number.isInteger(value) || value < 0)) throw new Error('设备数量必须是非负整数')
  const handled = item.boughtOutQuantity + item.returnedQuantity + item.lostQuantity
  if (handled > item.quantity) throw new Error('已退、已买断和已丢失数量之和不能超过原数量')
  return item
}

export function availableQuantity(item: RentalItemQuantities) {
  assertQuantityInvariant(item)
  return item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity
}

export type RentalDeviceSummaryItem = RentalItemQuantities & { deviceType: string }
export type RentalDeviceSummaryLine = { label: string; quantity: number }

const DEVICE_LABELS: Record<string, string> = {
  台式机: '主机',
  主机: '主机',
  显示器: '显示器',
  笔记本: '笔记本',
  一体机: '一体机',
}
const DEVICE_ORDER = ['主机', '显示器', '笔记本', '一体机']

export function rentalDeviceSummary(items: RentalDeviceSummaryItem[], maxLines = 3): RentalDeviceSummaryLine[] {
  const quantities = new Map<string, number>()
  for (const item of items) {
    const quantity = availableQuantity(item)
    if (quantity <= 0) continue
    const normalizedType = item.deviceType.trim()
    const label = DEVICE_LABELS[normalizedType] ?? (normalizedType || '其他设备')
    quantities.set(label, (quantities.get(label) ?? 0) + quantity)
  }

  const lines = [...quantities.entries()]
    .map(([label, quantity]) => ({ label, quantity }))
    .sort((left, right) => {
      const leftOrder = DEVICE_ORDER.indexOf(left.label)
      const rightOrder = DEVICE_ORDER.indexOf(right.label)
      return (leftOrder < 0 ? DEVICE_ORDER.length : leftOrder) - (rightOrder < 0 ? DEVICE_ORDER.length : rightOrder)
        || left.label.localeCompare(right.label, 'zh-CN')
    })
  if (maxLines < 1 || lines.length <= maxLines) return maxLines < 1 ? [] : lines

  const visible = lines.slice(0, maxLines - 1)
  const remainingQuantity = lines.slice(maxLines - 1).reduce((sum, line) => sum + line.quantity, 0)
  return [...visible, { label: '其他设备', quantity: remainingQuantity }]
}

export function rentalLifecycleStatus(items: RentalItemQuantities[]) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  const returned = items.reduce((sum, item) => sum + item.returnedQuantity, 0)
  const lost = items.reduce((sum, item) => sum + item.lostQuantity, 0)
  const bought = items.reduce((sum, item) => sum + item.boughtOutQuantity, 0)
  const handled = returned + lost + bought

  if (handled >= total) {
    if (bought === total) return '买断'
    if (returned === total) return '已退租'
    return '已结束'
  }
  if (returned > 0) return '部分退租'
  if (lost > 0) return '部分丢失'
  if (bought > 0) return '部分买断'
  return '在租'
}
