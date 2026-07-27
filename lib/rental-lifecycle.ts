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
