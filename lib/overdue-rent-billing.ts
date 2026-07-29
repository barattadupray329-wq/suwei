import { and, eq, inArray, lte, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { buyoutRecords, lossRecords, receivableBills, rentalItems, rentals, returnRecords } from '@/lib/db/schema'
import { addCalendarDays, fromCents, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { overdueRentPeriods, remainingQuantityAsOf, type RentalDisposal } from '@/lib/overdue-rent'

export async function ensureOverdueRentBills(userId: string, today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())) {
  const contracts = await db.select({ id: rentals.id, contractNo: rentals.contractNo, endDate: rentals.endDate, paidAmount: rentals.paidAmount })
    .from(rentals)
    .where(and(eq(rentals.userId, userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'), eq(rentals.billingType, 'monthly'), notInArray(rentals.status, ['已关闭', '已完成']), lte(rentals.endDate, addCalendarDays(today, -1))))
  if (!contracts.length) return { created: 0, amount: '0.00' }

  const rentalIds = contracts.map((contract) => contract.id)
  const [items, buyouts, returns, losses, existingBills] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, rentalIds))),
    db.select({ rentalItemId: buyoutRecords.rentalItemId, quantity: buyoutRecords.quantity, date: buyoutRecords.buyoutDate }).from(buyoutRecords).where(and(eq(buyoutRecords.userId, userId), inArray(buyoutRecords.rentalId, rentalIds))),
    db.select({ rentalItemId: returnRecords.rentalItemId, quantity: returnRecords.quantity, date: returnRecords.returnDate }).from(returnRecords).where(and(eq(returnRecords.userId, userId), inArray(returnRecords.rentalId, rentalIds))),
    db.select({ rentalItemId: lossRecords.rentalItemId, quantity: lossRecords.quantity, date: lossRecords.lossDate }).from(lossRecords).where(and(eq(lossRecords.userId, userId), inArray(lossRecords.rentalId, rentalIds))),
    db.select({ rentalId: receivableBills.rentalId, billNo: receivableBills.billNo, billType: receivableBills.billType, periodStart: receivableBills.periodStart, periodEnd: receivableBills.periodEnd }).from(receivableBills).where(and(eq(receivableBills.userId, userId), inArray(receivableBills.rentalId, rentalIds))),
  ])
  const existing = new Set(existingBills.map((bill) => bill.billNo))
  const existingOverduePeriods = new Set(existingBills.filter((bill) => bill.billType.includes('逾期')).map((bill) => `${bill.rentalId}:${bill.periodStart}`))
  const disposals: RentalDisposal[] = [...buyouts, ...returns, ...losses]
  const itemsByRental = new Map<number, typeof items>()
  for (const item of items) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])

  const bills = contracts.flatMap((contract) => overdueRentPeriods(contract.endDate, today).flatMap(({ periodStart, periodEnd }) => {
    const billNo = `OVERDUE-${contract.id}-${periodStart}`
    if (existing.has(billNo) || existingOverduePeriods.has(`${contract.id}:${periodStart}`)) return []
    const amountCents = (itemsByRental.get(contract.id) ?? []).reduce((sum, item) => {
      return sum + toCents(item.monthlyRent) * remainingQuantityAsOf(item.quantity, item.id, periodStart, disposals)
    }, 0)
    if (amountCents <= 0) return []
    return [{
      userId, rentalId: contract.id, billNo, periodStart, periodEnd, dueDate: periodStart,
      billType: '逾期续租租金', amount: fromCents(amountCents), paidAmount: '0.00', status: '待收',
      notes: `合同到期后继续使用，${periodStart} 至 ${periodEnd} 月租（周期结束日不含）`,
    }]
  }))
  if (!bills.length) return { created: 0, amount: '0.00' }

  for (const bill of bills) {
    await db.insert(receivableBills).values(bill).onConflictDoNothing()
  }
  const affectedIds = [...new Set(bills.map((bill) => bill.rentalId))]
  for (const rentalId of affectedIds) {
    const [contractBills, [contract]] = await Promise.all([
      db.select({ amount: receivableBills.amount, billType: receivableBills.billType }).from(receivableBills).where(and(eq(receivableBills.userId, userId), eq(receivableBills.rentalId, rentalId))),
      db.select({ paidAmount: rentals.paidAmount }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId))).limit(1),
    ])
    if (!contract) continue
    const totalCents = contractBills.filter((bill) => bill.billType !== '押金').reduce((sum, bill) => sum + toCents(bill.amount), 0)
    await db.update(rentals).set({ totalRent: fromCents(totalCents), paymentStatus: paymentStatusFromCents(totalCents, toCents(contract.paidAmount)), updatedAt: new Date() }).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId)))
  }
  return { created: bills.length, amount: fromCents(bills.reduce((sum, bill) => sum + toCents(bill.amount), 0)) }
}
