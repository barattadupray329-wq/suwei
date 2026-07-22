'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customerPhoneSessions, customerPortals, rentals } from '@/lib/db/schema'
import { getAccessContext } from '@/lib/access'

const ACTIVE_STATUSES = ['在租', '即将到期', '逾期']
const normalizePhone = (value: string) => value.replace(/\D/g, '')
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const legacySecret = () => digest(randomBytes(32).toString('hex'))

async function ensureCustomerAccessProfiles(ownerId: string) {
  const customers = await db.select({ phone: rentals.customerPhone, customerName: sql<string>`max(${rentals.customerName})` }).from(rentals).where(and(eq(rentals.userId, ownerId), inArray(rentals.status, ACTIVE_STATUSES))).groupBy(rentals.customerPhone)
  const existing = await db.select({ phone: customerPortals.phone }).from(customerPortals).where(eq(customerPortals.userId, ownerId))
  const known = new Set(existing.map((row) => normalizePhone(row.phone)))
  for (const customer of customers) {
    const phone = normalizePhone(customer.phone)
    if (!/^1\d{10}$/.test(phone) || known.has(phone)) continue
    await db.insert(customerPortals).values({ userId: ownerId, phone, customerName: customer.customerName, assigneeUserId: ownerId, accessTokenHash: legacySecret(), passwordHash: legacySecret(), status: 'active' })
  }
}

export async function getCustomerPortalCustomers() {
  const { userId: ownerId } = await getAccessContext('系统设置')
  await ensureCustomerAccessProfiles(ownerId)
  const grouped = await db.select({
    phone: rentals.customerPhone,
    customerName: sql<string>`max(${rentals.customerName})`,
    customerCompany: sql<string | null>`max(${rentals.customerCompany})`,
    contractCount: count(rentals.id),
    activeCount: sql<number>`coalesce(sum(case when ${rentals.status} in ('在租','即将到期','逾期') then 1 else 0 end), 0)`,
  }).from(rentals).where(eq(rentals.userId, ownerId)).groupBy(rentals.customerPhone)
  const portals = await db.select().from(customerPortals).where(eq(customerPortals.userId, ownerId))
  const sessionPhones = new Set((await db.select({ phone: customerPhoneSessions.phone }).from(customerPhoneSessions).where(eq(customerPhoneSessions.shopId, ownerId))).map((row) => row.phone))
  const portalMap = new Map(portals.map((portal) => [normalizePhone(portal.phone), portal]))
  return grouped.map((customer) => {
    const phone = normalizePhone(customer.phone)
    return { ...customer, phone, portal: portalMap.get(phone) ?? null, hasSession: sessionPhones.has(phone) }
  })
}

export async function setCustomerPortalStatus(phone: string, status: 'active' | 'paused') {
  const { userId: ownerId } = await getAccessContext('系统设置')
  const normalizedPhone = normalizePhone(phone)
  await db.update(customerPortals).set({ status, sessionVersion: sql`${customerPortals.sessionVersion} + 1`, updatedAt: new Date() }).where(and(eq(customerPortals.userId, ownerId), eq(customerPortals.phone, normalizedPhone)))
  if (status === 'paused') await db.delete(customerPhoneSessions).where(and(eq(customerPhoneSessions.shopId, ownerId), eq(customerPhoneSessions.phone, normalizedPhone)))
  revalidatePath('/customer-portals')
}

export async function revokeCustomerSessions(phone: string) {
  const { userId: ownerId } = await getAccessContext('系统设置')
  const normalizedPhone = normalizePhone(phone)
  const [portal] = await db.select({ id: customerPortals.id }).from(customerPortals).where(and(eq(customerPortals.userId, ownerId), eq(customerPortals.phone, normalizedPhone))).limit(1)
  if (!portal) throw new Error('客户访问档案不存在')
  await db.delete(customerPhoneSessions).where(and(eq(customerPhoneSessions.shopId, ownerId), eq(customerPhoneSessions.phone, normalizedPhone)))
  await db.update(customerPortals).set({ sessionVersion: sql`${customerPortals.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(customerPortals.id, portal.id))
  revalidatePath('/customer-portals')
}
