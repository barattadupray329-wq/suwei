'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { buyoutRecords, rentalItems, rentals } from '@/lib/db/schema'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('请先登录')
  return session.user.id
}

const itemSchema = z.object({
  deviceName: z.string().min(2), deviceType: z.enum(['台式机', '笔记本', '显示器', '一体机', '其他']), deviceCode: z.string().optional(), deviceConfig: z.string().optional(),
  quantity: z.coerce.number().int().positive(), monthlyRent: z.coerce.number().nonnegative(), totalRent: z.coerce.number().nonnegative(),
  cpu: z.string().optional(), motherboard: z.string().optional(), memory: z.string().optional(), storage: z.string().optional(), graphicsCard: z.string().optional(), powerSupply: z.string().optional(), caseModel: z.string().optional(), monitorInfo: z.string().optional(), screenSize: z.string().optional(), screenResolution: z.string().optional(), refreshRate: z.string().optional(), panelType: z.string().optional(), ports: z.string().optional(), batteryInfo: z.string().optional(), adapterInfo: z.string().optional(), accessories: z.string().optional(), colorGamut: z.string().optional(),
})
const rentalSchema = z.object({
  contractNo: z.string().min(2), customerName: z.string().min(2), customerPhone: z.string().min(6), customerAddress: z.string().optional(), startDate: z.string().min(1), endDate: z.string().min(1), deposit: z.coerce.number().nonnegative(), notes: z.string().optional(), items: z.array(itemSchema).min(1),
})
export type RentalItemInput = z.infer<typeof itemSchema>
export type RentalInput = z.infer<typeof rentalSchema>

export async function getRentals(query = '', status = '全部') {
  const userId = await getUserId()
  const filters = [eq(rentals.userId, userId)]
  if (query) filters.push(or(ilike(rentals.contractNo, `%${query}%`), ilike(rentals.customerName, `%${query}%`), ilike(rentals.customerPhone, `%${query}%`), ilike(rentals.deviceName, `%${query}%`))!)
  if (status !== '全部') filters.push(eq(rentals.status, status))
  const rows = await db.select().from(rentals).where(and(...filters)).orderBy(desc(rentals.createdAt))
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [items, buyouts] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, ids))).orderBy(rentalItems.id),
    db.select().from(buyoutRecords).where(and(eq(buyoutRecords.userId, userId), inArray(buyoutRecords.rentalId, ids))).orderBy(desc(buyoutRecords.createdAt)),
  ])
  return rows.map((row) => ({ ...row, items: items.filter((item) => item.rentalId === row.id), buyoutRecords: buyouts.filter((record) => record.rentalId === row.id) }))
}

export async function getDashboard() {
  const userId = await getUserId()
  const [summary] = await db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${rentals.status} = '在租')::int`, overdue: sql<number>`count(*) filter (where ${rentals.status} = '逾期')::int`, revenue: sql<string>`coalesce(sum(${rentals.paidAmount}), 0)`, receivable: sql<string>`coalesce(sum(${rentals.totalRent} - ${rentals.paidAmount}), 0)` }).from(rentals).where(eq(rentals.userId, userId))
  return summary
}

export async function createRental(input: RentalInput) {
  const userId = await getUserId()
  const value = rentalSchema.parse(input)
  if (new Date(value.endDate) < new Date(value.startDate)) throw new Error('结束日期不能早于开始日期')
  const quantity = value.items.reduce((sum, item) => sum + item.quantity, 0)
  const monthlyRent = value.items.reduce((sum, item) => sum + item.monthlyRent, 0)
  const totalRent = value.items.reduce((sum, item) => sum + item.totalRent, 0)
  await db.transaction(async (tx) => {
    const first = value.items[0]
    const [rental] = await tx.insert(rentals).values({ userId, contractNo: value.contractNo, customerName: value.customerName, customerPhone: value.customerPhone, customerAddress: value.customerAddress, startDate: value.startDate, endDate: value.endDate, deposit: String(value.deposit), notes: value.notes, deviceName: value.items.map((item) => item.deviceName).join('、'), deviceType: value.items.length > 1 ? '多设备' : first.deviceType, deviceCode: first.deviceCode, deviceConfig: first.deviceConfig, quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: '0', paymentStatus: '待收款', status: '在租' }).returning({ id: rentals.id })
    await tx.insert(rentalItems).values(value.items.map((item) => ({ ...item, userId, rentalId: rental.id, monthlyRent: String(item.monthlyRent), totalRent: String(item.totalRent) })))
  })
  revalidatePath('/')
}

export async function renewRental(id: number, endDate: string) {
  const userId = await getUserId()
  if (!endDate) throw new Error('请选择新的到期日期')
  await db.update(rentals).set({ endDate, status: '在租', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
  revalidatePath('/')
}

export async function collectPayment(id: number, amount: number) {
  const userId = await getUserId()
  if (amount <= 0) throw new Error('收款金额必须大于 0')
  const [row] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
  if (!row) throw new Error('记录不存在')
  const paid = Number(row.paidAmount) + amount
  await db.update(rentals).set({ paidAmount: String(paid), paymentStatus: paid >= Number(row.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
  revalidatePath('/')
}

export async function buyoutRentalItem(rentalId: number, rentalItemId: number, quantity: number, unitPrice: number, buyoutDate: string, notes = '') {
  const userId = await getUserId()
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('买断数量必须为正整数')
  if (unitPrice <= 0 || !buyoutDate) throw new Error('请填写有效的买断单价和日期')
  await db.transaction(async (tx) => {
    const [item] = await tx.select().from(rentalItems).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    if (!item) throw new Error('设备明细不存在')
    const remaining = item.quantity - item.boughtOutQuantity
    if (quantity > remaining) throw new Error(`最多可买断 ${remaining} 台`)
    const amount = quantity * unitPrice
    await tx.update(rentalItems).set({ boughtOutQuantity: item.boughtOutQuantity + quantity, buyoutAmount: String(Number(item.buyoutAmount) + amount), updatedAt: new Date() }).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.userId, userId)))
    await tx.insert(buyoutRecords).values({ userId, rentalId, rentalItemId, quantity, unitPrice: String(unitPrice), amount: String(amount), buyoutDate, notes })
    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const bought = allItems.reduce((sum, row) => sum + (row.id === item.id ? item.boughtOutQuantity + quantity : row.boughtOutQuantity), 0)
    const total = allItems.reduce((sum, row) => sum + row.quantity, 0)
    await tx.update(rentals).set({ status: bought >= total ? '买断' : '部分买断', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
  })
  revalidatePath('/')
}

export async function changeStatus(id: number, status: string) {
  const userId = await getUserId()
  if (!['在租', '逾期', '丢失'].includes(status)) throw new Error('无效状态')
  await db.update(rentals).set({ status, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
  revalidatePath('/')
}
