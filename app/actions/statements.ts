'use server'

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { businessSettings, receivableBills, rentals } from '@/lib/db/schema'

const VOID_STATUSES = new Set(['已作废', '作废', '已冲正', '已取消'])
const DAY_MS = 86_400_000

export type StatementBill = {
  id: number
  periodNo: number | null
  billType: string
  periodStart: string
  periodEnd: string
  dueDate: string
  amount: number
  paidAmount: number
  outstanding: number
  overdueDays: number
}

export type StatementContract = {
  id: number
  contractNo: string
  deviceName: string
  startDate: string
  endDate: string
  bills: StatementBill[]
}

export type CustomerStatement = {
  today: string
  generatedAt: string
  scope: 'customer' | 'contract'
  currentRentalId: number
  customer: { name: string; names: string[]; company: string | null; phone: string }
  contractCount: number
  lessor: { storeName: string; lessorName: string; contactName: string; phone: string; paymentInfo: string }
  contracts: StatementContract[]
  dueTotal: number
  dueCount: number
  upcomingTotal: number
  upcomingCount: number
}

function shanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function shanghaiDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

const cents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100)

type RentalRow = typeof rentals.$inferSelect

export async function getCustomerStatement(rentalId: number, scope: 'customer' | 'contract'): Promise<CustomerStatement> {
  const { userId } = await getAccessContext('租赁操作')
  if (!Number.isInteger(rentalId) || rentalId <= 0) throw new Error('合同不存在')

  const [current] = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId), isNull(rentals.deletedAt)))
  if (!current) throw new Error('合同不存在')

  const contractRows = scope === 'contract'
    ? [current]
    : await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.customerPhone, current.customerPhone), isNull(rentals.deletedAt))).orderBy(asc(rentals.startDate))
  return buildStatement(userId, current, contractRows, scope)
}

export async function getCustomerStatementByPhone(phone: string): Promise<CustomerStatement | null> {
  const { userId } = await getAccessContext('租赁操作')
  const normalized = phone.trim()
  if (!normalized) return null
  const contractRows = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.customerPhone, normalized), isNull(rentals.deletedAt))).orderBy(asc(rentals.startDate))
  const official = contractRows.filter((row) => row.orderType !== 'draft')
  if (!official.length) return null
  return buildStatement(userId, official[official.length - 1], contractRows, 'customer', false)
}

export type StatementCustomer = {
  phone: string
  names: string[]
  company: string | null
  contractCount: number
  dueTotal: number
  dueCount: number
  upcomingTotal: number
}

export async function listStatementCustomers(): Promise<StatementCustomer[]> {
  const { userId } = await getAccessContext('租赁操作')
  const rentalRows = await db
    .select({ id: rentals.id, phone: rentals.customerPhone, name: rentals.customerName, company: rentals.customerCompany, orderType: rentals.orderType })
    .from(rentals)
    .where(and(eq(rentals.userId, userId), isNull(rentals.deletedAt)))
  const official = rentalRows.filter((row) => row.orderType !== 'draft' && row.phone)
  const phoneByRental = new Map(official.map((row) => [row.id, row.phone]))
  const billRows = await db
    .select({ rentalId: receivableBills.rentalId, amount: receivableBills.amount, paidAmount: receivableBills.paidAmount, dueDate: receivableBills.dueDate, status: receivableBills.status })
    .from(receivableBills)
    .where(and(eq(receivableBills.userId, userId), isNull(receivableBills.reversedAt)))
  const today = shanghaiDate()

  const customers = new Map<string, { phone: string; names: Set<string>; company: string | null; contractCount: number; due: number; dueCount: number; upcoming: number }>()
  for (const row of official) {
    const entry = customers.get(row.phone) ?? { phone: row.phone, names: new Set<string>(), company: null, contractCount: 0, due: 0, dueCount: 0, upcoming: 0 }
    if (row.name) entry.names.add(row.name)
    if (row.company) entry.company = row.company
    entry.contractCount += 1
    customers.set(row.phone, entry)
  }
  for (const bill of billRows) {
    const phone = bill.rentalId ? phoneByRental.get(bill.rentalId) : undefined
    if (!phone || VOID_STATUSES.has(bill.status)) continue
    const outstanding = Math.max(0, cents(bill.amount) - cents(bill.paidAmount))
    if (outstanding <= 0) continue
    const entry = customers.get(phone)
    if (!entry) continue
    if (bill.dueDate <= today) { entry.due += outstanding; entry.dueCount += 1 } else entry.upcoming += outstanding
  }
  return Array.from(customers.values())
    .map((entry) => ({ phone: entry.phone, names: Array.from(entry.names), company: entry.company, contractCount: entry.contractCount, dueTotal: entry.due / 100, dueCount: entry.dueCount, upcomingTotal: entry.upcoming / 100 }))
    .sort((left, right) => right.dueTotal - left.dueTotal || right.upcomingTotal - left.upcomingTotal || left.names.join().localeCompare(right.names.join(), 'zh-CN'))
}

async function buildStatement(userId: string, current: RentalRow, contractRows: RentalRow[], scope: 'customer' | 'contract', keepCurrent = true): Promise<CustomerStatement> {

  const officialRows = contractRows.filter((row) => row.orderType !== 'draft')
  const ids = officialRows.map((row) => row.id)
  const billRows = ids.length
    ? await db.select().from(receivableBills).where(and(eq(receivableBills.userId, userId), inArray(receivableBills.rentalId, ids), isNull(receivableBills.reversedAt))).orderBy(asc(receivableBills.periodStart), asc(receivableBills.id))
    : []

  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.userId, userId))
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
