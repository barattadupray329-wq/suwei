export type RentalItemQuantities = {
  quantity: number
  boughtOutQuantity: number
  returnedQuantity: number
  lostQuantity: number
}

export function beijingDate(offsetDays = 0, timestamp = Date.now()) {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

export function remainingRentalQuantity(items: RentalItemQuantities[]) {
  return items.reduce(
    (total, item) =>
      total +
      Math.max(
        0,
        item.quantity -
          item.boughtOutQuantity -
          item.returnedQuantity -
          item.lostQuantity,
      ),
    0,
  )
}

export function hasRemainingRentalItems(items: RentalItemQuantities[]) {
  return remainingRentalQuantity(items) > 0
}
