'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rentals } from '@/lib/db/schema'

async function getUserId() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('请先登录'); return session.user.id }
const schema = z.object({ contractNo: z.string().min(2), customerName: z.string().min(2), customerPhone: z.string().min(6), customerAddress: z.string().optional(), deviceName: z.string().min(2), deviceConfig: z.string().optional(), deviceCode: z.string().optional(), quantity: z.coerce.number().int().positive(), startDate: z.string().min(1), endDate: z.string().min(1), monthlyRent: z.coerce.number().nonnegative(), totalRent: z.coerce.number().nonnegative(), deposit: z.coerce.number().nonnegative(), notes: z.string().optional() })
export type RentalInput = z.infer<typeof schema>

export async function getRentals(query = '', status = '全部') { const userId = await getUserId(); const filters = [eq(rentals.userId, userId)]; if (query) filters.push(or(ilike(rentals.contractNo, `%${query}%`), ilike(rentals.customerName, `%${query}%`), ilike(rentals.customerPhone, `%${query}%`), ilike(rentals.deviceName, `%${query}%`))!); if (status !== '全部') filters.push(eq(rentals.status, status)); return db.select().from(rentals).where(and(...filters)).orderBy(desc(rentals.createdAt)) }
export async function getDashboard() { const userId = await getUserId(); const [summary] = await db.select({ total: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${rentals.status} = '在租')::int`, overdue: sql<number>`count(*) filter (where ${rentals.status} = '逾期')::int`, revenue: sql<string>`coalesce(sum(${rentals.paidAmount}), 0)`, receivable: sql<string>`coalesce(sum(${rentals.totalRent} - ${rentals.paidAmount}), 0)` }).from(rentals).where(eq(rentals.userId, userId)); return summary }
export async function createRental(input: RentalInput) { const userId = await getUserId(); const v = schema.parse(input); if (new Date(v.endDate) < new Date(v.startDate)) throw new Error('结束日期不能早于开始日期'); await db.insert(rentals).values({ ...v, userId, monthlyRent: String(v.monthlyRent), totalRent: String(v.totalRent), deposit: String(v.deposit), paidAmount: '0', paymentStatus: '待收款', status: '在租' }); revalidatePath('/') }
export async function updateRental(id: number, input: RentalInput) { const userId = await getUserId(); const v = schema.parse(input); await db.update(rentals).set({ ...v, monthlyRent: String(v.monthlyRent), totalRent: String(v.totalRent), deposit: String(v.deposit), updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId))); revalidatePath('/') }
export async function renewRental(id: number, endDate: string) { const userId = await getUserId(); if (!endDate) throw new Error('请选择新的到期日期'); await db.update(rentals).set({ endDate, status: '在租', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId))); revalidatePath('/') }
export async function collectPayment(id: number, amount: number) { const userId = await getUserId(); if (amount <= 0) throw new Error('收款金额必须大于 0'); const [row] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, userId))); if (!row) throw new Error('记录不存在'); const paid = Number(row.paidAmount) + amount; await db.update(rentals).set({ paidAmount: String(paid), paymentStatus: paid >= Number(row.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId))); revalidatePath('/') }
export async function changeStatus(id: number, status: string) { const userId = await getUserId(); if (!['在租','逾期','已归还'].includes(status)) throw new Error('无效状态'); await db.update(rentals).set({ status, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId))); revalidatePath('/') }
