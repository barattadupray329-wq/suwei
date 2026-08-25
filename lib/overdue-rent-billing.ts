import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chunkRowsForD1 } from '@/lib/d1-batch'
import { buyoutRecords, lossRecords, receivableBills, rentalItems, rentals, returnRecords } from '@/lib/db/schema'
import { addCalendarDays, fromCents, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { overdueRentPeriods, remainingQuantityAsOf, type RentalDisposal } from '@/lib/overdue-rent'

// getRentals / getDashboard / 合同详情页都会在"页面被加载"时被动触发 ensureOverdueRentBills 做自愈，
// 而 Next.js 的链接预加载（hover 预取、同屏多个 tab 同时预取）会在同一瞬间对同一用户并发发起
// 好几个这样的调用。D1 底层是 SQLite，写操作全局互斥，一旦这些并发调用都撞上"确实有账单要补生成"
// 的窗口，其中一个的批量写入就可能因为锁冲突而抛异常——如果不做防护，这个异常会直接冒泡炸穿整个页面
// （Next.js 错误边界会把整页替换成"页面暂时无法加载"）。
// 这里做成"尽力而为"：失败先重试一次（短暂随机延迟避开瞬时锁冲突），仍失败则只打日志、不抛出，
// 让页面照常用已有数据渲染——自愈这次没跑成功，最多是账单still暂时没补上，绝不能因为这个后台兜底
// 逻辑本身的失败去拖垮一个原本只是"读数据"的页面。
export async function ensureOverdueRentBillsSafely(userId: string, today?: string, rentalId?: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ensureOverdueRentBills(userId, today, rentalId)
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 80 + Math.floor(Math.random() * 160)))
        continue
      }
      console.error('[v0] ensureOverdueRentBillsSafely 自愈失败，跳过本次补生成:', error)
      return { created: 0, amount: '0.00' }
    }
  }
  return { created: 0, amount: '0.00' }
}

export async function ensureOverdueRentBills(userId: string, today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date()), rentalId?: number) {
  // 不再仅按合同级 endDate 预筛选：部分续租会把某个设备明细的 endDate 续到未来，
  // 但同一合同下未续租的设备仍可能逾期，必须逐设备判断，否则会漏收逾期租金。
  const filters = [eq(rentals.userId, userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'), eq(rentals.billingType, 'monthly'), notInArray(rentals.status, ['已关闭', '已完成'])]
  if (rentalId) filters.push(eq(rentals.id, rentalId))
  const contracts = await db.select({ id: rentals.id, contractNo: rentals.contractNo, endDate: rentals.endDate, paidAmount: rentals.paidAmount })
    .from(rentals)
    .where(and(...filters))
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
  const existingOverduePeriodsByRental = new Map<number, typeof existingBills>()
  for (const bill of existingBills) {
    if (!bill.billType.includes('逾期')) continue
    existingOverduePeriodsByRental.set(bill.rentalId, [...(existingOverduePeriodsByRental.get(bill.rentalId) ?? []), bill])
  }
  const disposals: RentalDisposal[] = [...buyouts, ...returns, ...losses]
  const itemsByRental = new Map<number, typeof items>()
  for (const item of items) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])
  const yesterday = addCalendarDays(today, -1)

  const bills = contracts.flatMap((contract) => {
    const contractItems = itemsByRental.get(contract.id) ?? []
    // 按每个设备明细自己的到期日分组：没有单独续租过的设备仍共用合同级到期日，
    // 走原有的单笔合并账单；已续租到未来日期的设备单独分组，避免和未续租设备混算或被漏收。
    const groups = new Map<string, { effectiveEndDate: string; items: typeof contractItems }>()
    for (const item of contractItems) {
      const effectiveEndDate = item.endDate ?? contract.endDate
      const key = effectiveEndDate === contract.endDate ? 'default' : `item-${item.id}`
      const group = groups.get(key) ?? { effectiveEndDate, items: [] }
      group.items.push(item)
      groups.set(key, group)
    }
    const multiGroup = groups.size > 1
    const existingOverduePeriods = existingOverduePeriodsByRental.get(contract.id) ?? []
    return [...groups.entries()].flatMap(([key, group]) => {
      if (group.effectiveEndDate > yesterday) return []
      return overdueRentPeriods(group.effectiveEndDate, today).flatMap(({ periodStart, periodEnd }) => {
        const billNo = multiGroup ? `OVERDUE-${contract.id}-${key}-${periodStart}` : `OVERDUE-${contract.id}-${periodStart}`
        const overlapsExistingOverdue = existingOverduePeriods.some((bill) => bill.periodStart < periodEnd && bill.periodEnd > periodStart)
        if (existing.has(billNo) || overlapsExistingOverdue) return []
        const amountCents = group.items.reduce((sum, item) => sum + toCents(item.monthlyRent) * remainingQuantityAsOf(item.quantity, item.id, periodStart, disposals), 0)
        if (amountCents <= 0) return []
        return [{
          userId, rentalId: contract.id, billNo, periodStart, periodEnd, dueDate: periodStart,
          billType: '逾期续租租金', amount: fromCents(amountCents), paidAmount: '0.00', status: '待收',
          notes: `合同到期后继续使用，${periodStart} 至 ${periodEnd} 月租（周期结束日不含）`,
        }]
      })
    })
  })
  if (!bills.length) return { created: 0, amount: '0.00' }

  const insertStatements = chunkRowsForD1(bills).map((chunk) => db.insert(receivableBills).values(chunk).onConflictDoNothing())
  if (insertStatements.length) await db.batch(insertStatements as [typeof insertStatements[number], ...Array<typeof insertStatements[number]>])

  const affectedIds = [...new Set(bills.map((bill) => bill.rentalId))]
  const contractBills = await db.select({ rentalId: receivableBills.rentalId, amount: receivableBills.amount, billType: receivableBills.billType })
    .from(receivableBills)
    .where(and(eq(receivableBills.userId, userId), inArray(receivableBills.rentalId, affectedIds)))
  const totalsByRental = new Map<number, number>()
  for (const bill of contractBills) {
    if (bill.billType === '押金') continue
    totalsByRental.set(bill.rentalId, (totalsByRental.get(bill.rentalId) ?? 0) + toCents(bill.amount))
  }
  const paidByRental = new Map(contracts.map((contract) => [contract.id, toCents(contract.paidAmount)]))
  const now = new Date()
  const updateStatements = affectedIds.map((rentalId) => {
    const totalCents = totalsByRental.get(rentalId) ?? 0
    return db.update(rentals)
      .set({ totalRent: fromCents(totalCents), paymentStatus: paymentStatusFromCents(totalCents, paidByRental.get(rentalId) ?? 0), updatedAt: now })
      .where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId)))
  })
  for (let offset = 0; offset < updateStatements.length; offset += 50) {
    const chunk = updateStatements.slice(offset, offset + 50)
    await db.batch(chunk as [typeof chunk[number], ...Array<typeof chunk[number]>])
  }
  return { created: bills.length, amount: fromCents(bills.reduce((sum, bill) => sum + toCents(bill.amount), 0)) }
}
