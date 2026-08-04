export type ReturnRentMode = 'full_month' | 'daily' | 'waive'

const DAY_MS = 86_400_000
const cents = (value: number) => Math.round(value * 100)

export function calculateReturnRent(input: {
  periodStart: string
  periodEnd: string
  returnDate: string
  fullAmount: number
  collectedAmount: number
  mode: ReturnRentMode
}) {
  const elapsed = Math.ceil((Date.parse(`${input.returnDate}T00:00:00+08:00`) - Date.parse(`${input.periodStart}T00:00:00+08:00`)) / DAY_MS) + 1
  const usedDays = Math.max(0, Math.min(30, elapsed))
  const remainingDays = Math.max(0, 30 - usedDays)
  const full = cents(Math.max(0, input.fullAmount))
  const collected = Math.min(full, cents(Math.max(0, input.collectedAmount)))
  const charge = input.mode === 'full_month' ? full : input.mode === 'daily' ? Math.min(full, Math.round(full * usedDays / 30)) : 0
  return {
    usedDays,
    remainingDays,
    dailyAmount: full / 30 / 100,
    chargeAmount: charge / 100,
    refundAmount: Math.max(0, Math.min(collected, collected - charge)) / 100,
    collectAmount: Math.max(0, charge - collected) / 100,
    adjustmentAmount: (full - charge) / 100,
  }
}
