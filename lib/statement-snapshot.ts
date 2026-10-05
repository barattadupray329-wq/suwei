import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { businessSettings, receivableBills, rentalItems, rentals } from '@/lib/db/schema'
import { addCalendarDays, addCalendarMonths } from '@/lib/rental-calculations'
import { DUE_REMINDER_DAYS_AHEAD, remainingRentalQuantity } from '@/lib/sms-reminder-rules'
import type { CustomerStatement, StatementBill, StatementContract } from '@/app/actions/statements'

const VOID_STATUSES = new Set(['已作废', '作废', '已冲正', '已取消'])
const ACTIVE_STATUSES = new Set(['在租', '即将到期', '部分买断', '部分退租'])
const DAY_MS = 86_400_000

type RentalRow = typeof rentals.$inferSelect
type ItemRow = { rentalId: number; quantity: number; boughtOutQuantity: number; returnedQuantity: number; lostQuantity: number; monthlyRent: string }

export function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function shanghaiDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

const cents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100)

// 合同到期前 DUE_REMINDER_DAYS_AHEAD 天内，下个月的续租账单通常还没生成；对账单按剩余在租台数
// 预估下期租金一并列出，让客户收到提醒时就能看到下月要付多少。
function projectedNextRentCents(rental: RentalRow, items: ItemRow[], today: string) {
  if (rental.orderType !== 'official' || rental.lifecycleStatus !== 'active' || !ACTIVE_STATUSES.has(rental.status)) return 0
  if (rental.billingType && rental.billingType !== 'monthly') return 0
  if (rental.endDate < today || rental.endDate > addCalendarDays(today, DUE_REMINDER_DAYS_AHEAD)) return 0
  return items
    .filter((item) => item.rentalId === rental.id)
    .reduce((total, item) => total + remainingRentalQuantity([item]) * cents(item.monthlyRent), 0)
}

export async function getCustomerStatementSnapshot(userId: string, phone: string): Promise<CustomerStatement | null> {
  const contractRows = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.customerPhone, phone), isNull(rentals.deletedAt))).orderBy(asc(rentals.startDate))
  const official = contractRows.filter((row) => row.orderType !== 'draft')
  if (!official.length) return null
  return buildStatement(userId, official[official.length - 1], contractRows, 'customer', false)
}

export async function buildStatement(userId: string, current: RentalRow, contractRows: RentalRow[], scope: 'customer' | 'contract', keepCurrent = true): Promise<CustomerStatement> {

  const officialRows = contractRows.filter((row) => row.orderType !== 'draft')
  const ids = officialRows.map((row) => row.id)
  const billRows = ids.length
    ? await db.select().from(receivableBills).where(and(eq(receivableBills.userId, userId), inArray(receivableBills.rentalId, ids), isNull(receivableBills.reversedAt))).orderBy(asc(receivableBills.periodStart), asc(receivableBills.id))
    : []

  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.userId, userId))
  const itemRows = ids.length
    ? await db.select({ rentalId: rentalItems.rentalId, quantity: rentalItems.quantity, boughtOutQuantity: rentalItems.boughtOutQuantity, returnedQuantity: rentalItems.returnedQuantity, lostQuantity: rentalItems.lostQuantity, monthlyRent: rentalItems.monthlyRent }).from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, ids)))
    : []
  const today = shanghaiDate()
  const todayMs = Date.parse(`${today}T00:00:00Z`)

  let dueCents = 0
  let dueCount = 0
  let upcomingCents = 0
  let upcomingCount = 0

  const contracts: StatementContract[] = officialRows.map((rental) => {
    const ownBills = billRows.filter((bill) => bill.rentalId === rental.id && !VOID_STATUSES.has(bill.status))
    let periodCounter = 0
    const bills: StatementBill[] = []
    for (const bill of ownBills) {
      const isRent = !bill.billType.includes('押金')
      const periodNo = isRent ? ++periodCounter : null
      const outstandingCents = Math.max(0, cents(bill.amount) - cents(bill.paidAmount))
      if (outstandingCents <= 0) continue
      const overdueDays = Math.max(0, Math.round((todayMs - Date.parse(`${bill.dueDate}T00:00:00Z`)) / DAY_MS))
      const isDue = bill.dueDate <= today
      if (isDue) { dueCents += outstandingCents; dueCount += 1 } else { upcomingCents += outstandingCents; upcomingCount += 1 }
      bills.push({
        id: bill.id,
        periodNo,
        billType: bill.billType,
        periodStart: bill.periodStart,
        periodEnd: bill.periodEnd,
        dueDate: bill.dueDate,
        amount: cents(bill.amount) / 100,
        paidAmount: cents(bill.paidAmount) / 100,
        outstanding: outstandingCents / 100,
        overdueDays: isDue ? overdueDays : 0,
      })
    }
    const nextStart = addCalendarDays(rental.endDate, 1)
    const projectedCents = projectedNextRentCents(rental, itemRows, today)
    const alreadyBilled = ownBills.some((bill) => !bill.billType.includes('押金') && bill.periodStart >= nextStart)
    if (projectedCents > 0 && !alreadyBilled) {
      upcomingCents += projectedCents
      upcomingCount += 1
      bills.push({
        id: -rental.id,
        periodNo: periodCounter + 1,
        billType: '下期租金（预计）',
        periodStart: nextStart,
        periodEnd: addCalendarMonths(nextStart, 1),
        dueDate: nextStart,
        amount: projectedCents / 100,
        paidAmount: 0,
        outstanding: projectedCents / 100,
        overdueDays: 0,
      })
    }
    return { id: rental.id, contractNo: rental.contractNo, deviceName: rental.deviceName, startDate: rental.startDate, endDate: rental.endDate, bills }
  }).filter((contract) => contract.bills.length > 0 || (keepCurrent && contract.id === current.id))

  return {
    today,
    generatedAt: shanghaiDateTime(),
    scope,
    currentRentalId: keepCurrent ? current.id : 0,
    customer: {
      name: current.customerName,
      names: Array.from(new Set([current.customerName, ...officialRows.map((row) => row.customerName)].filter(Boolean))),
      company: current.customerCompany,
      phone: current.customerPhone,
    },
    contractCount: officialRows.length,
    lessor: {
      storeName: settings?.storeName || '速维租赁',
      lessorName: settings?.lessorName || '',
      contactName: settings?.contactName || '',
      phone: settings?.phone || '',
      paymentInfo: settings?.paymentInfo || '',
    },
    contracts,
    dueTotal: dueCents / 100,
    dueCount,
    upcomingTotal: upcomingCents / 100,
    upcomingCount,
  }
}
