import { and, eq, inArray, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { receivableBills, rentalItems, rentals } from '@/lib/db/schema'
import { addCalendarDays, addCalendarMonths, fromCents, overdueBillingMonths, toCents } from '@/lib/rental-calculations'
import { availableQuantity } from '@/lib/rental-lifecycle'
import { beijingDate } from '@/lib/sms-reminder-rules'

const ACTIVE_STATUSES = ['在租', '即将到期', '逾期', '部分买断', '部分退租', '部分丢失']

export async function processAutomaticOverdueBills(currentDate = beijingDate()) {
  const contracts = await db.select().from(rentals).where(and(
    lt(rentals.endDate, currentDate),
    inArray(rentals.status, ACTIVE_STATUSES),
    eq(rentals.orderType, 'official'),
    eq(rentals.lifecycleStatus, 'active'),
  ))
  if (!contracts.length) return { currentDate, scanned: 0, created: 0, skipped: 0 }

  const contractIds = contracts.map((contract) => contract.id)
  const [items, bills] = await Promise.all([
    db.select().from(rentalItems).where(inArray(rentalItems.rentalId, contractIds)),
    db.select().from(receivableBills).where(inArray(receivableBills.rentalId, contractIds)),
  ])
  const itemsByRental = new Map<number, typeof items>()
  const billsByRental = new Map<number, typeof bills>()
  for (const item of items) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])
  for (const bill of bills) billsByRental.set(bill.rentalId, [...(billsByRental.get(bill.rentalId) ?? []), bill])

  let created = 0
  let skipped = 0
  for (const contract of contracts) {
    const months = overdueBillingMonths(contract.endDate, currentDate)
    const activeItems = (itemsByRental.get(contract.id) ?? []).filter((item) => availableQuantity(item) > 0)
    const monthlyCents = activeItems.reduce((sum, item) => sum + availableQuantity(item) * toCents(item.monthlyRent), 0)
    if (!months || !monthlyCents) {
      skipped += 1
      continue
    }
    const existing = billsByRental.get(contract.id) ?? []
    for (let month = 1; month <= months; month += 1) {
      const billNo = `YQ-${contract.contractNo}-${String(month).padStart(3, '0')}`
      if (existing.some((bill) => bill.billNo === billNo)) continue
      const periodStart = addCalendarDays(addCalendarMonths(contract.endDate, month - 1), 1)
      const periodEnd = addCalendarMonths(contract.endDate, month)
      await db.insert(receivableBills).values({
        userId: contract.userId,
        rentalId: contract.id,
        billNo,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        billType: '逾期租金',
        amount: fromCents(monthlyCents),
        paidAmount: '0.00',
        status: '逾期',
        notes: `系统自动生成：逾期第 ${month} 个月，不满一个月按一个月计费`,
      }).onConflictDoNothing()
      created += 1
    }
  }
  return { currentDate, scanned: contracts.length, created, skipped }
}
