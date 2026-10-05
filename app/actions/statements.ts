'use server'

import { and, asc, eq, isNull } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { receivableBills, rentals } from '@/lib/db/schema'
import { buildStatement, shanghaiDate } from '@/lib/statement-snapshot'

const VOID_STATUSES = new Set(['已作废', '作废', '已冲正', '已取消'])

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

const cents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100)

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
