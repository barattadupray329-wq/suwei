export type RentalItemQuantities = {
  quantity: number
  boughtOutQuantity: number
  returnedQuantity: number
  lostQuantity: number
}

export function availableQuantity(item: RentalItemQuantities) {
  return Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity)
}

export function rentalLifecycleStatus(items: RentalItemQuantities[]) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  const returned = items.reduce((sum, item) => sum + item.returnedQuantity, 0)
  const lost = items.reduce((sum, item) => sum + item.lostQuantity, 0)
  const bought = items.reduce((sum, item) => sum + item.boughtOutQuantity, 0)
  const handled = returned + lost + bought

  if (handled >= total) {
    if (lost > 0) return '已结束'
    if (bought === total) return '买断'
    return '已退租'
  }
  if (returned > 0) return '部分退租'
  if (lost > 0) return '部分丢失'
  if (bought > 0) return '部分买断'
  return '在租'
}
