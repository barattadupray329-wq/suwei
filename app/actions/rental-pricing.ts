'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { adjustablePeriodLimit, billingPeriodFromBills, periodNumberAt } from '@/lib/billing-periods'
import { db } from '@/lib/db'
import { auditLogs, receivableBills, rentalEvents, rentalItems, rentalPricePeriods, rentals } from '@/lib/db/schema'
import { fromCents, toCents } from '@/lib/rental-calculations'
import { availableQuantity } from '@/lib/rental-lifecycle'
import { priceAtPeriod, setPriceNode, type RentalPricePeriod } from '@/lib/rental-price-periods'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'

const inputSchema = z.object({
  rentalId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  startPeriod: z.number().int().min(1).max(1200),
  unitPrice: z.coerce.number().positive('租金单价必须大于 0'),
  reason: z.string().trim().min(2, '请填写至少 2 个字的调价原因').max(200),
  notes: z.string().trim().max(500).optional(),
})
export type PeriodRentChangeInput = z.infer<typeof inputSchema>

const settledStatuses = new Set(['已结清', '已收款', '部分收款'])
const rentBill = (billType: string) => billType === '租金' || billType === '续租费' || billType.includes('逾期')

export async function changePeriodRents(input: PeriodRentChangeInput[]) {
  const access = await getAccessContext('租赁操作')
  const values = z.array(inputSchema).min(1).max(100).parse(input)
  const rentalId = values[0].rentalId
  if (values.some((value) => value.rentalId !== rentalId)) throw new Error('按期调价必须属于同一合同')
  if (new Set(values.map((value) => value.itemId)).size !== values.length) throw new Error('同一设备不能重复提交')

  const [[rental], items, storedPeriods, bills] = await Promise.all([
    db.select().from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.id, rentalId))).limit(1),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, access.userId), eq(rentalItems.rentalId, rentalId))),
    db.select().from(rentalPricePeriods).where(and(eq(rentalPricePeriods.userId, access.userId), eq(rentalPricePeriods.rentalId, rentalId))),
    db.select().from(receivableBills).where(and(eq(receivableBills.userId, access.userId), eq(receivableBills.rentalId, rentalId))),
  ])
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以按期调整租金')
  if (rental.billingType !== 'monthly') throw new Error('按期调价仅适用于按月计费合同')
  const itemById = new Map(items.map((item) => [item.id, item]))
  const now = new Date()
  const changes = values.map((value) => {
    const item = itemById.get(value.itemId)
    if (!item || availableQuantity(item) <= 0) throw new Error('包含不存在或已处置的设备')
    const anchorDate = item.startDate ?? rental.startDate
    const operationDate = now.toISOString().slice(0, 10)
    const itemRentBills = bills.filter((bill) => rentBill(bill.billType))
    const effective = billingPeriodFromBills(anchorDate, value.startPeriod, itemRentBills)
    const lastAdjustablePeriod = adjustablePeriodLimit(anchorDate, operationDate, itemRentBills.map((bill) => bill.periodStart))
    if (value.startPeriod > lastAdjustablePeriod) throw new Error(`${item.deviceName} 暂时只能调整到第 ${lastAdjustablePeriod} 期（下一账期）`)
    const lockedBill = bills.find((bill) => rentBill(bill.billType) && bill.periodStart < effective.endExclusive && bill.periodEnd >= effective.start && (toCents(bill.paidAmount) > 0 || settledStatuses.has(bill.status)))
    if (lockedBill) throw new Error(`${item.deviceName} 第 ${value.startPeriod} 期已有收款，禁止修改租金`)
    const current = storedPeriods.filter((period) => period.rentalItemId === item.id)
    const oldUnitPrice = priceAtPeriod(current, value.startPeriod, item.monthlyRent)
    if (toCents(oldUnitPrice) === toCents(value.unitPrice)) throw new Error(`${item.deviceName} 第 ${value.startPeriod} 期的新租金与当前价格相同`)
    const ranges = setPriceNode({ periods: current, startPeriod: value.startPeriod, unitPrice: String(value.unitPrice), fallback: item.monthlyRent, lastPeriod: 1200 })
    return { value, item, anchorDate, effective, oldUnitPrice, ranges }
  })

  const nextByItem = new Map<number, RentalPricePeriod[]>()
  for (const item of items) nextByItem.set(item.id, storedPeriods.filter((period) => period.rentalItemId === item.id))
  for (const change of changes) nextByItem.set(change.item.id, change.ranges)
  const statements: Array<Parameters<typeof db.batch>[0][number]> = []

  for (const change of changes) {
    statements.push(db.delete(rentalPricePeriods).where(and(eq(rentalPricePeriods.userId, access.userId), eq(rentalPricePeriods.rentalItemId, change.item.id))))
    for (const range of change.ranges) {
      const itemRentBills = bills.filter((bill) => rentBill(bill.billType))
      const start = billingPeriodFromBills(change.anchorDate, range.startPeriod, itemRentBills).start
      const endExclusive = billingPeriodFromBills(change.anchorDate, range.endPeriod, itemRentBills).endExclusive
      statements.push(db.insert(rentalPricePeriods).values({ userId: access.userId, rentalId, rentalItemId: change.item.id, startPeriod: range.startPeriod, endPeriod: range.endPeriod, effectiveStart: start, effectiveEndExclusive: endExclusive, quantity: availableQuantity(change.item), unitPrice: fromCents(toCents(range.unitPrice)), source: range.startPeriod === change.value.startPeriod ? 'period_adjustment' : 'price_history', notes: change.value.notes }))
    }
    const finalPrice = change.ranges.at(-1)!.unitPrice
    statements.push(
      db.update(rentalItems).set({ monthlyRent: fromCents(toCents(finalPrice)), totalRent: fromCents(toCents(finalPrice) * change.item.quantity), updatedAt: now }).where(and(eq(rentalItems.userId, access.userId), eq(rentalItems.id, change.item.id))),
      db.insert(rentalEvents).values({ userId: access.userId, rentalId, itemId: change.item.id, eventType: '按期调价', status: '已完成', eventDate: change.effective.start, beforeSnapshot: { period: change.value.startPeriod, unitPrice: change.oldUnitPrice }, afterSnapshot: { period: change.value.startPeriod, unitPrice: fromCents(toCents(change.value.unitPrice)), continuesUntilNextChange: true }, reason: change.value.reason, operatorName: access.actorName, notes: change.value.notes }),
      db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '按期调整租金', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo} ${change.item.deviceName} 从第 ${change.value.startPeriod} 期起，租金由 ${Number(change.oldUnitPrice).toFixed(2)} 元调整为 ${change.value.unitPrice.toFixed(2)} 元，沿用至下次调价`, metadata: { itemId: change.item.id, startPeriod: change.value.startPeriod, effectiveStart: change.effective.start, oldUnitPrice: Number(change.oldUnitPrice), newUnitPrice: change.value.unitPrice, reason: change.value.reason } }),
    )
  }

  let billDifferenceCents = 0
  for (const bill of bills.filter((entry) => rentBill(entry.billType) && toCents(entry.paidAmount) === 0 && !settledStatuses.has(entry.status))) {
    const applicable = changes.some((change) => bill.periodStart >= change.effective.start)
    if (!applicable || !bill.billType.includes('逾期')) continue
    const amountCents = items.reduce((sum, item) => {
      const anchor = item.startDate ?? rental.startDate
      let periodNo: number
      try { periodNo = periodNumberAt(anchor, bill.periodStart) } catch { return sum + toCents(item.monthlyRent) * availableQuantity(item) }
      return sum + toCents(priceAtPeriod(nextByItem.get(item.id) ?? [], periodNo, item.monthlyRent)) * availableQuantity(item)
    }, 0)
    billDifferenceCents += amountCents - toCents(bill.amount)
    statements.push(db.update(receivableBills).set({ amount: fromCents(amountCents), notes: `${bill.notes ?? ''}；已按阶梯租金重算`, updatedAt: now }).where(and(eq(receivableBills.userId, access.userId), eq(receivableBills.id, bill.id))))
  }

  const finalMonthlyCents = items.reduce((sum, item) => {
    const changed = changes.find((change) => change.item.id === item.id)
    const unitPrice = changed?.ranges.at(-1)?.unitPrice ?? item.monthlyRent
    return sum + toCents(unitPrice) * availableQuantity(item)
  }, 0)
  const totalRentCents = toCents(rental.totalRent) + billDifferenceCents
  statements.push(db.update(rentals).set({ monthlyRent: fromCents(finalMonthlyCents), totalRent: fromCents(totalRentCents), paymentStatus: paymentStatusFromCents(totalRentCents, toCents(rental.paidAmount)), updatedAt: now }).where(and(eq(rentals.userId, access.userId), eq(rentals.id, rentalId))))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
  return { ok: true, changed: changes.length }
}
