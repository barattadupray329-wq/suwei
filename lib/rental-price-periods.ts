import { billingPeriod } from './billing-periods'
import { fromCents, toCents } from './rental-calculations'

export type RentalPricePeriod = {
  startPeriod: number
  endPeriod: number
  unitPrice: string
  source?: string
}

export type PriceNode = { startPeriod: number; unitPrice: string }

export function priceAtPeriod(periods: RentalPricePeriod[], periodNo: number, fallback: string) {
  const match = periods
    .filter((period) => period.startPeriod <= periodNo && period.endPeriod >= periodNo)
    .sort((a, b) => b.startPeriod - a.startPeriod)[0]
  return match?.unitPrice ?? fallback
}

export function priceNodes(periods: RentalPricePeriod[], fallback: string): PriceNode[] {
  const sorted = [...periods].sort((a, b) => a.startPeriod - b.startPeriod)
  const nodes: PriceNode[] = [{ startPeriod: 1, unitPrice: fallback }]
  for (const period of sorted) {
    const previous = nodes.at(-1)
    if (previous?.startPeriod === period.startPeriod) previous.unitPrice = period.unitPrice
    else if (!previous || toCents(previous.unitPrice) !== toCents(period.unitPrice)) nodes.push({ startPeriod: period.startPeriod, unitPrice: period.unitPrice })
  }
  return nodes
}

export function setPriceNode(input: {
  periods: RentalPricePeriod[]
  startPeriod: number
  unitPrice: string
  fallback: string
  lastPeriod: number
}) {
  const byStart = new Map(priceNodes(input.periods, input.fallback).map((node) => [node.startPeriod, node.unitPrice]))
  byStart.set(input.startPeriod, fromCents(toCents(input.unitPrice)))
  const nodes = [...byStart.entries()]
    .filter(([start]) => start <= input.lastPeriod)
    .sort(([a], [b]) => a - b)
    .filter((entry, index, all) => index === 0 || toCents(entry[1]) !== toCents(all[index - 1][1]))
  return nodes.map(([startPeriod, unitPrice], index) => ({
    startPeriod,
    endPeriod: (nodes[index + 1]?.[0] ?? input.lastPeriod + 1) - 1,
    unitPrice,
  }))
}

export function periodPriceRows(input: {
  anchorDate: string
  lastPeriod: number
  periods: RentalPricePeriod[]
  fallback: string
}) {
  return Array.from({ length: input.lastPeriod }, (_, index) => {
    const periodNo = index + 1
    const period = billingPeriod(input.anchorDate, periodNo)
    return { ...period, unitPrice: priceAtPeriod(input.periods, periodNo, input.fallback) }
  })
}

export function priceChangeImpact(input: {
  oldUnitPrice: string
  newUnitPrice: string
  quantity: number
  periods: number
}) {
  const differenceCents = (toCents(input.newUnitPrice) - toCents(input.oldUnitPrice)) * input.quantity * input.periods
  return { differenceCents, difference: fromCents(differenceCents) }
}
