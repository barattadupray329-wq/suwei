import { addCalendarDays, addCalendarMonths } from './rental-calculations'

export type RentalDisposal = { rentalItemId: number; quantity: number; date: string }

export function overdueRentPeriods(endDate: string, today: string) {
  const periods: Array<{ periodStart: string; periodEnd: string }> = []
  let periodStart = addCalendarDays(endDate, 1)
  while (periodStart <= today) {
    const nextStart = addCalendarMonths(periodStart, 1)
    periods.push({ periodStart, periodEnd: nextStart })
    periodStart = nextStart
  }
  return periods
}

export function remainingQuantityAsOf(itemQuantity: number, itemId: number, periodStart: string, disposals: RentalDisposal[]) {
  const disposed = disposals
    .filter((row) => row.rentalItemId === itemId && row.date <= periodStart)
    .reduce((sum, row) => sum + row.quantity, 0)
  return Math.max(0, itemQuantity - disposed)
}
