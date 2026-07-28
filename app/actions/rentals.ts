'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, buyoutRecords, contractSnapshots, customerPortals, lossRecords, organizationMembers, paymentAllocations, paymentRecords, receivableBills, renewalAdjustments, renewalRecords, rentalEvents, rentalItems, rentals, returnRecords, user } from '@/lib/db/schema'
import { fromCents, overdueMonthlyAmount, rentalEndDate, renewalAdjustment, renewalAmount, toCents } from '@/lib/rental-calculations'
import { buildRentalNumbers, normalizeRentalDate } from '@/lib/rental-numbers'
import { normalizeDeviceName, normalizeStartDateReason, START_DATE_REASONS, validateRentalItemFields } from '@/lib/rental-form-rules'
import { toActionResult } from '@/lib/action-result'
import { safeError } from '@/lib/errors'
import { chunkRowsForD1 } from '@/lib/d1-batch'
import { DRAFT_IMPORT_LIMIT } from '@/lib/draft-import'
import { availableQuantity, rentalLifecycleStatus } from '@/lib/rental-lifecycle'
import { assertNoRentalActivity, assertSameDayOfficialRental } from '@/lib/rental-trash-policy'
import { allocatePayment, billOutstandingCents, centsToMoney, moneyToCents } from '@/lib/payment-allocation'

async function getUserId() {
  return (await getAccessContext('租赁操作')).userId
}

export async function getCustomerOfferSuggestion(phone: string) {
  const userId = await getUserId()
  const normalized = phone.replace(/\D/g, '')
  if (!/^1\d{10}$/.test(normalized)) return null
  const [customer] = await db.select({ name: customerPortals.customerName, level: customerPortals.customerLevel, note: customerPortals.levelNote }).from(customerPortals).where(and(eq(customerPortals.userId, userId), eq(customerPortals.phone, normalized), eq(customerPortals.status, 'active'))).limit(1)
  if (!customer) return null
  const offers = { silver: { label: '银牌', discount: 1, suggestion: '原价' }, gold: { label: '金牌', discount: 0.95, suggestion: '95 折' }, diamond: { label: '钻石', discount: 0.9, suggestion: '9 折' }, king: { label: '王者', discount: 0.85, suggestion: '85 折' } } as const
  const offer = offers[customer.level as keyof typeof offers] ?? offers.silver
  return { ...customer, ...offer }
}

function assertOfficialRental(rental: { orderType: string; lifecycleStatus: string }) {
  if (rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('该操作仅适用于正式有效合同')
}

const itemSchema = z.object({
  deviceName: z.string().default(''), deviceType: z.enum(['台式机', '笔记本', '显示器', '一体机', '其他']), deviceCode: z.string().optional(), deviceConfig: z.string().optional(),
  quantity: z.coerce.number().int().positive(), monthlyRent: z.coerce.number().positive('租金单价必须大于 0'), totalRent: z.coerce.number().positive(),
  cpu: z.string().optional(), motherboard: z.string().optional(), memory: z.string().optional(), storage: z.string().optional(), graphicsCard: z.string().optional(), powerSupply: z.string().optional(), caseModel: z.string().optional(), monitorInfo: z.string().optional(), screenSize: z.string().optional(), screenResolution: z.string().optional(), refreshRate: z.string().optional(), panelType: z.string().optional(), ports: z.string().optional(), batteryInfo: z.string().optional(), adapterInfo: z.string().optional(), accessories: z.string().optional(), colorGamut: z.string().optional(),
})
const rentalSchema = z.object({
  contractNo: z.string().default(''), customerCompany: z.string().optional(), customerName: z.string().min(2), customerPhone: z.string().min(6), customerAddress: z.string().optional(), billingType: z.enum(['monthly', 'daily']).default('monthly'), duration: z.coerce.number().int().min(1).max(3650).default(1), startDate: z.string().min(1), startDateReason: z.enum(START_DATE_REASONS).optional(), endDate: z.string().min(1), deposit: z.coerce.number().nonnegative(), notes: z.string().optional(), assigneeUserId: z.string().optional(), items: z.array(itemSchema).min(1),
})
export type RentalItemInput = z.infer<typeof itemSchema>
export type RentalInput = z.infer<typeof rentalSchema>
export type RentalOrderType = 'draft' | 'test' | 'official'
const initialCollectionSchema = z.object({
  collectRent: z.boolean().default(false),
  collectDeposit: z.boolean().default(false),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']),
})
export type InitialCollectionInput = z.infer<typeof initialCollectionSchema>

export async function getNextRentalNumbers(startDate: string, items: Array<Pick<RentalItemInput, 'deviceType' | 'quantity'>>) {
  const userId = await getUserId()
  const date = normalizeRentalDate(startDate)
  const stamp = date.replaceAll('-', '')
  const [contractRows, deviceRows] = await Promise.all([
    db.select({ contractNo: rentals.contractNo }).from(rentals).where(and(eq(rentals.userId, userId), like(rentals.contractNo, `HT${stamp}-%`))),
    db.select({ deviceCode: rentalItems.deviceCode }).from(rentalItems).where(and(eq(rentalItems.userId, userId), like(rentalItems.deviceCode, `%${stamp}-%`))),
  ])
  return buildRentalNumbers(
    date,
    items,
    contractRows.map((row) => row.contractNo),
    deviceRows.map((row) => row.deviceCode),
  )
}

export async function getRentals(query = '', status = '全部', limit?: number) {
  const userId = await getUserId()
  const filters = [eq(rentals.userId, userId), eq(rentals.lifecycleStatus, 'active')]
  if (query) filters.push(or(like(rentals.contractNo, `%${query}%`), like(rentals.customerCompany, `%${query}%`), like(rentals.customerName, `%${query}%`), like(rentals.customerPhone, `%${query}%`), like(rentals.deviceName, `%${query}%`))!)
  if (status !== '全部') filters.push(eq(rentals.status, status))
  const baseQuery = db.select().from(rentals).where(and(...filters)).orderBy(desc(rentals.createdAt))
  const rows = limit ? await baseQuery.limit(Math.min(Math.max(limit, 1), 100)) : await baseQuery
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [items, buyouts, renewals, renewalCorrections, payments, events, bills, ledger] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, ids))).orderBy(rentalItems.id),
    db.select().from(buyoutRecords).where(and(eq(buyoutRecords.userId, userId), inArray(buyoutRecords.rentalId, ids))).orderBy(desc(buyoutRecords.createdAt)),
    db.select().from(renewalRecords).where(and(eq(renewalRecords.userId, userId), inArray(renewalRecords.rentalId, ids))).orderBy(desc(renewalRecords.createdAt)),
    db.select().from(renewalAdjustments).where(and(eq(renewalAdjustments.userId, userId), inArray(renewalAdjustments.rentalId, ids))).orderBy(desc(renewalAdjustments.createdAt), desc(renewalAdjustments.id)),
    db.select().from(paymentRecords).where(and(eq(paymentRecords.userId, userId), inArray(paymentRecords.rentalId, ids))).orderBy(desc(paymentRecords.createdAt)),
    db.select().from(rentalEvents).where(and(eq(rentalEvents.userId, userId), inArray(rentalEvents.rentalId, ids))).orderBy(desc(rentalEvents.eventDate), desc(rentalEvents.createdAt)),
    db.select().from(receivableBills).where(and(eq(receivableBills.userId, userId), inArray(receivableBills.rentalId, ids))).orderBy(receivableBills.dueDate),
    db.select().from(accountLedger).where(and(eq(accountLedger.userId, userId), inArray(accountLedger.rentalId, ids))).orderBy(desc(accountLedger.entryDate), desc(accountLedger.createdAt)),
  ])
  const groupByRental = <T extends { rentalId: number }>(records: T[]) => {
    const grouped = new Map<number, T[]>()
    for (const record of records) grouped.set(record.rentalId, [...(grouped.get(record.rentalId) ?? []), record])
    return grouped
  }
  const itemMap = groupByRental(items)
  const buyoutMap = groupByRental(buyouts)
  const correctionsByRenewal = new Map<number, typeof renewalCorrections>()
  for (const correction of renewalCorrections) correctionsByRenewal.set(correction.renewalRecordId, [...(correctionsByRenewal.get(correction.renewalRecordId) ?? []), correction])
  const renewalsWithCorrections = renewals.map((renewal) => ({ ...renewal, adjustments: correctionsByRenewal.get(renewal.id) ?? [] }))
  const renewalMap = groupByRental(renewalsWithCorrections)
  const paymentMap = groupByRental(payments)
  const eventMap = groupByRental(events)
  const billMap = groupByRental(bills)
  const ledgerMap = groupByRental(ledger)
  return rows.map((row) => {
    const rentalItemRows = itemMap.get(row.id) ?? []
    const quantity = rentalItemRows.reduce((sum, item) => sum + availableQuantity(item), 0)
    return { ...row, quantity, status: quantity === 0 && rentalItemRows.length > 0 ? rentalLifecycleStatus(rentalItemRows) : row.status, items: rentalItemRows, buyoutRecords: buyoutMap.get(row.id) ?? [], renewalRecords: renewalMap.get(row.id) ?? [], paymentRecords: paymentMap.get(row.id) ?? [], events: eventMap.get(row.id) ?? [], bills: billMap.get(row.id) ?? [], ledger: ledgerMap.get(row.id) ?? [] }
  })
}

const rentalQuerySchema = z.object({
  query: z.string().trim().max(80).default(''),
  status: z.string().trim().max(20).default('全部'),
  startDate: z.string().max(10).default(''),
  endDate: z.string().max(10).default(''),
  assignee: z.string().trim().max(100).default(''),
  orderType: z.enum(['all', 'draft', 'test', 'official']).default('all'),
  lifecycleStatus: z.enum(['active', 'trash']).default('active'),
  sort: z.enum(['newest', 'oldest', 'due', 'amount']).default('newest'),
  page: z.coerce.number().int().min(1).max(500000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type RentalListQuery = z.input<typeof rentalQuerySchema>

export async function getRentalPage(input: RentalListQuery = {}) {
  const userId = await getUserId()
  const value = rentalQuerySchema.parse(input)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const filters = [eq(rentals.userId, userId), eq(rentals.lifecycleStatus, value.lifecycleStatus)]
  if (value.orderType !== 'all') filters.push(eq(rentals.orderType, value.orderType))
  if (value.query) {
    const pattern = `%${value.query}%`
    filters.push(or(like(rentals.contractNo, pattern), like(rentals.customerCompany, pattern), like(rentals.customerName, pattern), like(rentals.customerPhone, pattern), like(rentals.deviceName, pattern), like(rentals.deviceCode, pattern))!)
  }
  const terminalStatuses = ['买断', '已买断', '已退租', '已退回', '已结束', '已关闭', '已完成', '丢失', '已丢失']
  const activeByDate = sql<boolean>`${rentals.status} not in (${sql.join(terminalStatuses.map((status) => sql`${status}`), sql`, `)})`
  const statusAliases: Record<string, string[]> = {
    已退回: ['已退回', '已退租'],
    已买断: ['已买断', '买断'],
    已丢失: ['已丢失', '丢失'],
    已完成: ['已完成', '已结束'],
  }
  if (value.status === '到期') filters.push(sql`${rentals.endDate} = ${today} and ${activeByDate}`)
  else if (value.status === '逾期') filters.push(sql`${rentals.endDate} < ${today} and ${activeByDate}`)
  else if (value.status !== '全部') {
    const aliases = statusAliases[value.status] ?? [value.status]
    filters.push(sql`${rentals.status} in (${sql.join(aliases.map((status) => sql`${status}`), sql`, `)})`)
  }
  if (value.startDate) filters.push(gte(rentals.startDate, value.startDate))
  if (value.endDate) filters.push(lte(rentals.endDate, value.endDate))
  if (value.assignee) filters.push(eq(rentals.assigneeUserId, value.assignee))
  const where = and(...filters)
  const remainingQuantity = sql<number>`coalesce((select sum(max(ri.quantity - ri."boughtOutQuantity" - ri."returnedQuantity" - ri."lostQuantity", 0)) from rental_items ri where ri."rentalId" = ${rentals.id} and ri."userId" = ${userId}), ${rentals.quantity}, 0)`
  const finishedPriority = sql<number>`case when ${rentals.status} in (${sql.join(terminalStatuses.map((status) => sql`${status}`), sql`, `)}) or ${remainingQuantity} <= 0 then 1 else 0 end`
  const selectedOrder = value.sort === 'oldest'
    ? [finishedPriority, asc(rentals.createdAt)]
    : value.sort === 'due'
      ? [finishedPriority, asc(rentals.endDate)]
      : value.sort === 'amount'
        ? [finishedPriority, desc(sql`cast(${rentals.totalRent} as real)`)]
        : [finishedPriority, asc(rentals.endDate), desc(rentals.createdAt)]
  const offset = (value.page - 1) * value.pageSize
  const [[countRow], rows, matchingRentalRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(rentals).where(where),
    db.select({ id: rentals.id, orderType: rentals.orderType, lifecycleStatus: rentals.lifecycleStatus, deletedAt: rentals.deletedAt, contractNo: rentals.contractNo, customerCompany: rentals.customerCompany, customerName: rentals.customerName, customerPhone: rentals.customerPhone, deviceName: rentals.deviceName, quantity: rentals.quantity, startDate: rentals.startDate, endDate: rentals.endDate, totalRent: rentals.totalRent, paidAmount: rentals.paidAmount, paymentStatus: rentals.paymentStatus, status: rentals.status, assigneeName: rentals.assigneeName, createdAt: rentals.createdAt }).from(rentals).where(where).orderBy(...selectedOrder, desc(rentals.id)).limit(value.pageSize).offset(offset),
    db.select({ id: rentals.id, endDate: rentals.endDate, status: rentals.status, monthlyRent: rentals.monthlyRent }).from(rentals).where(where),
  ])
  const allRentalIds = matchingRentalRows.map((row) => row.id)
  const allItemRows = allRentalIds.length
    ? await db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, allRentalIds)))
    : []
  const itemsByRental = new Map<number, typeof allItemRows>()
  for (const item of allItemRows) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])
  const dateAtUtcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`)
  const overdueDays = (endDate: string) => Math.max(0, Math.floor((dateAtUtcMidnight(today) - dateAtUtcMidnight(endDate)) / 86_400_000))
  const overdueRent = (rental: { id: number; endDate: string; status: string; monthlyRent: string }) => {
    if (terminalStatuses.includes(rental.status)) return 0
    const days = overdueDays(rental.endDate)
    if (!days) return 0
    const items = itemsByRental.get(rental.id) ?? []
    const monthlyRent = items.length
      ? items.reduce((sum, item) => sum + Number(item.monthlyRent) * availableQuantity(item), 0)
      : Number(rental.monthlyRent)
    return Number(overdueMonthlyAmount(monthlyRent, rental.endDate, today))
  }
  const legacyStatusAliases: Record<string, string> = { 买断: '已买断', 已退租: '已退回', 丢失: '已丢失', 已结束: '已完成' }
  const normalizeLegacyStatus = (status: string) => legacyStatusAliases[status] ?? status
  const normalizedRows = rows.map((row) => {
    const items = itemsByRental.get(row.id) ?? []
    const quantity = items.reduce((sum, item) => sum + availableQuantity(item), 0)
    const lifecycleStatus = items.length > 0 ? rentalLifecycleStatus(items) : normalizeLegacyStatus(row.status)
    const isTerminal = terminalStatuses.includes(lifecycleStatus)
    const expired = row.endDate < today && !isTerminal
    const dueToday = row.endDate === today && !isTerminal
    const status = expired ? '逾期' : dueToday ? '到期' : lifecycleStatus
    return {
      ...row,
      quantity,
      status,
      overdueDays: expired ? overdueDays(row.endDate) : 0,
      overdueRent: expired ? overdueRent({ ...row, status: lifecycleStatus, monthlyRent: '0' }) : 0,
    }
  })
  const overdueRentTotal = matchingRentalRows.reduce((sum, row) => sum + overdueRent(row), 0)
  const total = Number(countRow?.count ?? 0)
  return { rows: normalizedRows, total, overdueRentTotal, page: value.page, pageSize: value.pageSize, pageCount: Math.max(1, Math.ceil(total / value.pageSize)) }
}

export async function getRentalById(id: number) {
  const userId = await getUserId()
  const [row] = await db.select({ contractNo: rentals.contractNo }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, id))).limit(1)
  if (!row) return null
  return (await getRentals(row.contractNo, '全部', 1))[0] ?? null
}

export async function getDashboard() {
  const userId = await getUserId()
  const [[summary], activeDeviceRows] = await Promise.all([
    db.select({
      total: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'official' then 1 else 0 end), 0)`,
      draft: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'draft' then 1 else 0 end), 0)`,
      active: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'official' and ${rentals.status} in ('在租', '逾期', '部分买断', '部分退租', '部分丢失', '丢失') then 1 else 0 end), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'official' and (${rentals.status} = '逾期' or (${rentals.endDate} < current_date and ${rentals.status} in ('在租', '部分买断', '部分退租', '部分丢失'))) then 1 else 0 end), 0)`,
      dueSoon: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'official' and ${rentals.endDate} between current_date and date(current_date, '+7 days') and ${rentals.status} in ('在租', '部分买断', '部分退租', '部分丢失') then 1 else 0 end), 0)`,
      repairPending: sql<number>`coalesce(sum(case when ${rentals.orderType} = 'official' and ${rentals.status} = '维修中' then 1 else 0 end), 0)`,
      revenue: sql<string>`coalesce(sum(case when ${rentals.orderType} = 'official' then ${rentals.paidAmount} else 0 end), 0)`,
      receivable: sql<string>`coalesce(sum(case when ${rentals.orderType} = 'official' and ${rentals.status} not in ('已关闭', '已买断') then ${rentals.totalRent} - ${rentals.paidAmount} else 0 end), 0)`,
    }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.lifecycleStatus, 'active'))),
    db.select({
      deviceType: rentalItems.deviceType,
      quantity: sql<number>`coalesce(sum(max(${rentalItems.quantity} - ${rentalItems.boughtOutQuantity} - ${rentalItems.returnedQuantity} - ${rentalItems.lostQuantity}, 0)), 0)`,
    }).from(rentalItems).innerJoin(rentals, and(eq(rentals.id, rentalItems.rentalId), eq(rentals.userId, rentalItems.userId))).where(and(
      eq(rentalItems.userId, userId),
      eq(rentals.orderType, 'official'),
      eq(rentals.lifecycleStatus, 'active'),
      sql`${rentals.deletedAt} is null`,
      sql`${rentals.status} not in ('已关闭', '已完成', '已退回', '已买断', '已丢失')`,
    )).groupBy(rentalItems.deviceType),
  ])
  const activeDevices = { 台式机: 0, 显示器: 0, 一体机: 0, 笔记本: 0 }
  for (const row of activeDeviceRows) {
    if (row.deviceType in activeDevices) activeDevices[row.deviceType as keyof typeof activeDevices] = Number(row.quantity)
  }
  return { ...summary, draft: summary?.draft ?? 0, activeDevices }
}

export type RentalAssignee = { id: string; name: string; role: 'admin' | 'employee' }

export async function getRentalAssignees(): Promise<RentalAssignee[]> {
  const access = await getAccessContext('租赁操作')
  if (access.role === 'employee') return [{ id: access.actorId, name: access.actorName, role: 'employee' }]
  const members = await db.select({ id: user.id, name: user.name }).from(organizationMembers).innerJoin(user, eq(user.id, organizationMembers.memberUserId)).where(and(eq(organizationMembers.ownerId, access.userId), eq(organizationMembers.active, true)))
  return [{ id: access.actorId, name: access.actorName, role: 'admin' }, ...members.map((member) => ({ ...member, role: 'employee' as const }))]
}

async function resolveRentalAssignee(access: Awaited<ReturnType<typeof getAccessContext>>, requestedId?: string) {
  if (access.role === 'employee') return { id: access.actorId, name: access.actorName }
  const assigneeId = requestedId || access.actorId
  if (assigneeId === access.actorId) return { id: access.actorId, name: access.actorName }
  const [member] = await db.select({ id: user.id, name: user.name }).from(organizationMembers).innerJoin(user, eq(user.id, organizationMembers.memberUserId)).where(and(eq(organizationMembers.ownerId, access.userId), eq(organizationMembers.memberUserId, assigneeId), eq(organizationMembers.active, true)))
  if (!member) throw new Error('维护负责人不属于当前店铺或账号已停用')
  return member
}

// 批量 INSERT 需要按 D1 的绑定变量上限拆分（见 lib/d1-batch.ts），
// 拆出的多条语句仍放进同一个 batch，以保持原子性。
function buildChunkedInserts(table: Parameters<typeof db.insert>[0], rows: Record<string, unknown>[]) {
  return chunkRowsForD1(rows).map((chunk) => db.insert(table).values(chunk as never))
}

function buildBillInsertStatements<T extends Record<string, unknown>>(bills: T[], userId: string) {
  return buildChunkedInserts(receivableBills, bills.map((bill) => ({ ...bill, userId })))
}

function buildPrepaidRentBill(rentalId: number, contractNo: string, startDate: string, endDate: string, totalRent: number, duration: number) {
  return [{
    rentalId,
    billNo: `${contractNo}-001`,
    periodStart: startDate,
    periodEnd: endDate,
    dueDate: startDate,
    amount: totalRent.toFixed(2),
    billType: '起租预收',
    status: '待收',
    notes: `起租 ${duration} 个月一次预收`,
  }]
}

async function createRentalOperation(input: RentalInput, orderType: RentalOrderType, initialCollection?: InitialCollectionInput) {
  const access = await getAccessContext('租赁操作')
  if (orderType === 'test' && access.role === 'employee') throw new Error('仅管理员可创建测试合同')
  const userId = access.userId
  const value = rentalSchema.parse(input)
  const collection = orderType === 'official' && initialCollection ? initialCollectionSchema.parse(initialCollection) : null
  const assignee = await resolveRentalAssignee(access, value.assigneeUserId)
  const startDateReason = normalizeStartDateReason(value.startDate, value.startDateReason)
  const itemError = value.items.map(validateRentalItemFields).find(Boolean)
  if (itemError) throw new Error(itemError)
  const expectedEndDate = rentalEndDate(value.startDate, value.duration, value.billingType)
  if (value.endDate !== expectedEndDate) throw new Error('到期日期与计费方式、起租日期或租赁时间不一致')
  const numbers = await getNextRentalNumbers(value.startDate, value.items)
  const temporaryStamp = `${Date.now()}-${crypto.getRandomValues(new Uint16Array(1))[0]}`
  const contractNo = orderType === 'official' ? numbers.contractNo : `${orderType === 'draft' ? 'CG' : 'CS'}-${temporaryStamp}`
  const normalizedItems = value.items.map((item, index) => ({
  ...item,
  deviceName: normalizeDeviceName(item.deviceType, item.deviceName),
  deviceCode: orderType === 'official' ? numbers.deviceCodes[index] : `${orderType === 'draft' ? 'CG' : 'CS'}-SB-${temporaryStamp}-${index + 1}`,
    totalRent: Math.round(item.quantity * item.monthlyRent * value.duration * 100) / 100,
  }))
  const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0)
  const monthlyRent = normalizedItems.reduce((sum, item) => sum + item.monthlyRent * item.quantity, 0)
  const totalRent = normalizedItems.reduce((sum, item) => sum + item.totalRent, 0)
  const rentalId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  try {
    const first = value.items[0]
    // D1 不支持交互式事务；预先生成有序且低碰撞的安全整数 ID，随后用 batch 原子提交全部关联记录。
    const bills = value.billingType === 'daily'
      ? [{ rentalId, billNo: `${contractNo}-001`, periodStart: value.startDate, periodEnd: value.endDate, dueDate: value.startDate, amount: totalRent.toFixed(2), billType: '日租租金', status: '待收' }]
      : buildPrepaidRentBill(rentalId, contractNo, value.startDate, value.endDate, totalRent, value.duration)
    const allBills = orderType === 'official' ? (value.deposit > 0 ? [...bills, { rentalId, billNo: `${contractNo}-DEP`, periodStart: value.startDate, periodEnd: value.startDate, dueDate: value.startDate, amount: value.deposit.toFixed(2), billType: '押金', status: '待收' }] : bills) : []
    const billBaseId = rentalId + 100
    const identifiedBills = allBills.map((bill, index) => ({ ...bill, id: billBaseId + index }))
    const rentBill = identifiedBills.find((bill) => bill.billType !== '押金')
    const depositBill = identifiedBills.find((bill) => bill.billType === '押金')
    const collectRent = Boolean(collection?.collectRent && rentBill)
    const collectDeposit = Boolean(collection?.collectDeposit && depositBill)
    const rentPaymentId = rentalId + 10
    const depositPaymentId = rentalId + 11
    const paidRent = collectRent ? totalRent : 0
    const statements: Array<Parameters<typeof db.batch>[0][number]> = [
      db.insert(rentals).values({ id: rentalId, userId, sourceUserId: access.actorId, sourceName: access.actorName, assignedEmployeeId: assignee.id, assigneeUserId: assignee.id, assigneeName: assignee.name, orderType, lifecycleStatus: 'active', confirmedAt: orderType === 'official' ? new Date() : null, confirmedBy: orderType === 'official' ? access.actorId : null, contractNo, customerCompany: value.customerCompany?.trim() || null, customerName: value.customerName, customerPhone: value.customerPhone, customerAddress: value.customerAddress, startDate: value.startDate, startDateReason, endDate: value.endDate, billingType: value.billingType, duration: value.duration, deposit: String(value.deposit), notes: [`计费方式：${value.billingType === 'daily' ? '日租' : '月租'}；租赁时间：${value.duration}${value.billingType === 'daily' ? '天' : '个月'}`, value.notes?.trim()].filter(Boolean).join('\n'), deviceName: normalizedItems.map((item) => item.deviceName).join('、'), deviceType: normalizedItems.length > 1 ? '多设备' : first.deviceType, deviceCode: normalizedItems[0].deviceCode, deviceConfig: first.deviceConfig, quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: String(paidRent), paymentStatus: collectRent ? '已结清' : '待收款', status: '在租' }),
      ...buildChunkedInserts(rentalItems, normalizedItems.map((item) => ({ ...item, userId, rentalId, startDate: value.startDate, endDate: value.endDate, monthlyRent: String(item.monthlyRent), totalRent: String(item.totalRent) }))),
      ...buildBillInsertStatements(identifiedBills.map((bill) => ({ ...bill, paidAmount: (collectRent && bill.billType !== '押金') || (collectDeposit && bill.billType === '押金') ? bill.amount : '0', status: (collectRent && bill.billType !== '押金') || (collectDeposit && bill.billType === '押金') ? '已结清' : '待收' })), userId),
    ]
    if (collectRent && rentBill && collection) statements.push(
      db.insert(paymentRecords).values({ id: rentPaymentId, userId, rentalId, amount: rentBill.amount, paymentDate: collection.paymentDate, paymentMethod: collection.paymentMethod, feeType: '原合同租金', operatorName: access.actorName, notes: '创建正式合同时即时收取租金' }),
      db.insert(paymentAllocations).values({ userId, rentalId, paymentRecordId: rentPaymentId, billId: rentBill.id, amount: rentBill.amount }),
    )
    if (collectDeposit && depositBill && collection) statements.push(
      db.insert(paymentRecords).values({ id: depositPaymentId, userId, rentalId, amount: depositBill.amount, paymentDate: collection.paymentDate, paymentMethod: collection.paymentMethod, feeType: '押金', operatorName: access.actorName, notes: '创建正式合同时即时收取押金' }),
      db.insert(paymentAllocations).values({ userId, rentalId, paymentRecordId: depositPaymentId, billId: depositBill.id, amount: depositBill.amount }),
      db.insert(accountLedger).values({ userId, rentalId, entryType: '押金收取', amount: depositBill.amount, entryDate: collection.paymentDate, paymentRecordId: depositPaymentId, operatorName: access.actorName, notes: '创建正式合同时即时收取押金' }),
    )
    statements.push(
      db.insert(auditLogs).values({ userId, actorUserId: access.actorId, actorName: access.actorName, action: '创建', resourceType: '租赁合同', resourceId: String(rentalId), summary: `创建${orderType === 'official' ? '正式' : orderType === 'test' ? '测试' : '草稿'}合同 ${contractNo}（${value.customerCompany || value.customerName}）`, metadata: { totalRent, quantity, orderType, collectRent, collectDeposit, paymentDate: collection?.paymentDate, paymentMethod: collection?.paymentMethod } }),
    )
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  } catch (error) {
    const cause = typeof error === 'object' && error && 'cause' in error ? error.cause : error
    if (typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505') throw new Error(`合同编号“${numbers.contractNo}”已存在，请更换后再保存`)
    throw error
  }
  revalidatePath('/')
  return rentalId
}

export async function createRental(input: RentalInput, orderType: RentalOrderType = 'official', initialCollection?: InitialCollectionInput) {
  return toActionResult('创建租赁合同', () => createRentalOperation(input, orderType, initialCollection))
}

export async function updateRentalAssignee(rentalId: number, assigneeUserId: string) {
  const access = await getAccessContext('合同管理')
  if (access.role === 'employee') throw new Error('仅管理员可调整维护负责人')
  const assignee = await resolveRentalAssignee(access, assigneeUserId)
  const [rental] = await db.select({ id: rentals.id, contractNo: rentals.contractNo, assigneeName: rentals.assigneeName }).from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId)))
  if (!rental) throw new Error('租赁合同不存在')
  await db.batch([
    db.update(rentals).set({ assignedEmployeeId: assignee.id, assigneeUserId: assignee.id, assigneeName: assignee.name, updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId))),
    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '调整负责人', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo}：${rental.assigneeName || '未分配'} → ${assignee.name}`, metadata: { previousAssignee: rental.assigneeName, assigneeUserId: assignee.id, assigneeName: assignee.name } }),
  ])
  revalidatePath('/dashboard')
}

const settlementSchema = z.object({ timing: z.enum(['now', 'later']), date: z.string().min(1), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })
export type SettlementInput = z.infer<typeof settlementSchema>

const renewalSchema = z.object({ rentalItemId: z.number().int().positive(), quantity: z.number().int().positive(), billingUnit: z.enum(['month', 'day']), duration: z.number().int().min(1).max(3650), unitPrice: z.number().positive('续租单价必须大于 0'), newEndDate: z.string().min(1), notes: z.string().optional() })
export type RenewalInput = z.infer<typeof renewalSchema>

function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export async function renewRentalItems(rentalId: number, inputs: RenewalInput[], settlementInput: SettlementInput) {
  const access = await getAccessContext('租赁操作')
  const userId = access.userId
  const values = z.array(renewalSchema).min(1, '请至少选择一项设备').parse(inputs)
  const settlement = settlementSchema.parse(settlementInput)
  { const tx = db
    const [rental] = await tx.select().from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
  if (!rental) throw new Error('租赁合同不存在')
  assertOfficialRental(rental)
  let addedRent = 0
    for (const value of values) {
      const [item] = await tx.select().from(rentalItems).where(and(eq(rentalItems.id, value.rentalItemId), eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
      if (!item) throw new Error('设备明细不存在')
      const oldEndDate = item.endDate ?? rental.endDate
      const startDate = item.startDate ?? rental.startDate
      if (value.newEndDate <= oldEndDate) throw new Error(`${item.deviceName} 的新到期日必须晚于原到期日`)
      const available = availableQuantity(item)
      if (value.quantity > available) throw new Error(`${item.deviceName} 最多可续租 ${available} 台`)
      const newEndDate = value.billingUnit === 'month' ? addCalendarMonths(oldEndDate, value.duration) : addCalendarDays(oldEndDate, value.duration)
      if (value.newEndDate !== newEndDate) throw new Error(`${item.deviceName} 的续租时长与到期日不一致`)
      const amount = Number(renewalAmount(value.quantity, value.unitPrice, value.duration))
      addedRent = Number(fromCents(toCents(addedRent) + toCents(amount)))
      const effectiveMonthlyRent = value.billingUnit === 'month' ? value.unitPrice : value.unitPrice * 30
      let renewedItemId = item.id
      if (value.quantity === available && item.boughtOutQuantity === 0) {
        await tx.update(rentalItems).set({ endDate: newEndDate, monthlyRent: String(effectiveMonthlyRent), totalRent: String(effectiveMonthlyRent * item.quantity), updatedAt: new Date() }).where(and(eq(rentalItems.id, item.id), eq(rentalItems.userId, userId)))
      } else {
        const remainingQuantity = item.quantity - value.quantity
        await tx.update(rentalItems).set({ quantity: remainingQuantity, totalRent: String(Number(item.monthlyRent) * remainingQuantity), updatedAt: new Date() }).where(and(eq(rentalItems.id, item.id), eq(rentalItems.userId, userId)))
        const [split] = await tx.insert(rentalItems).values({ userId, rentalId, deviceName: item.deviceName, deviceType: item.deviceType, deviceCode: item.deviceCode, deviceConfig: item.deviceConfig, quantity: value.quantity, startDate, endDate: newEndDate, monthlyRent: String(effectiveMonthlyRent), totalRent: String(effectiveMonthlyRent * value.quantity), boughtOutQuantity: 0, buyoutAmount: '0', cpu: item.cpu, motherboard: item.motherboard, memory: item.memory, storage: item.storage, graphicsCard: item.graphicsCard, powerSupply: item.powerSupply, caseModel: item.caseModel, monitorInfo: item.monitorInfo, screenSize: item.screenSize, screenResolution: item.screenResolution, refreshRate: item.refreshRate, panelType: item.panelType, ports: item.ports, batteryInfo: item.batteryInfo, adapterInfo: item.adapterInfo, accessories: item.accessories, colorGamut: item.colorGamut }).returning({ id: rentalItems.id })
        renewedItemId = split.id
      }
      const renewalDate = new Date().toISOString().slice(0, 10)
      const renewalPeriodStart = addCalendarDays(oldEndDate, 1)
      const [renewal] = await tx.insert(renewalRecords).values({ userId, rentalId, sourceRentalItemId: item.id, renewedRentalItemId: renewedItemId, quantity: value.quantity, renewalMonths: value.billingUnit === 'month' ? value.duration : null, billingUnit: value.billingUnit, duration: value.duration, unitPrice: String(value.unitPrice), oldMonthlyRent: item.monthlyRent, newMonthlyRent: String(effectiveMonthlyRent), oldEndDate, newEndDate, renewalAmount: String(amount), renewalDate, notes: value.notes }).returning({ id: renewalRecords.id })
      await tx.insert(receivableBills).values({ userId, rentalId, billNo: `RENEW-${rentalId}-${renewal.id}`, periodStart: renewalPeriodStart, periodEnd: newEndDate, dueDate: settlement.date, billType: '续租费', amount: String(amount), paidAmount: settlement.timing === 'now' ? String(amount) : '0', status: settlement.timing === 'now' ? '已结清' : '待收', notes: `${item.deviceName} ${value.quantity} 台续租 ${value.duration}${value.billingUnit === 'month' ? '个月' : '天'}；${settlement.timing === 'now' ? '本次已收款' : '约定以后收款'}` })
      if (settlement.timing === 'now') await tx.insert(paymentRecords).values({ userId, rentalId, renewalRecordId: renewal.id, amount: String(amount), paymentDate: settlement.date, paymentMethod: settlement.method, feeType: '续租费', operatorName: access.actorName, notes: `${item.deviceName} ${value.quantity} 台续租即时收款` })
      await tx.insert(rentalEvents).values({ userId, rentalId, itemId: renewedItemId, eventType: '续租', status: '已完成', eventDate: renewalDate, beforeSnapshot: { quantity: value.quantity, endDate: oldEndDate, monthlyRent: item.monthlyRent }, afterSnapshot: { quantity: value.quantity, endDate: newEndDate, monthlyRent: String(effectiveMonthlyRent), settlement: settlement.timing }, feeAdjustment: String(amount), operatorName: access.actorName, notes: value.notes })
    }
    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const active = allItems.filter((item) => availableQuantity(item) > 0)
    const quantity = active.reduce((sum, item) => sum + availableQuantity(item), 0)
    const monthlyRent = active.reduce((sum, item) => sum + Number(item.monthlyRent) * availableQuantity(item), 0)
    const totalRent = Number(rental.totalRent) + addedRent
    const paidAmount = Number(rental.paidAmount) + (settlement.timing === 'now' ? addedRent : 0)
    const endDate = active.map((item) => item.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate
    const status = rental.status === '逾期' ? '在租' : rental.status
    await tx.update(rentals).set({ quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: String(paidAmount), endDate, status, paymentStatus: paidAmount >= totalRent ? '已结清' : paidAmount > 0 ? '部分收款' : '待收款', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
    await tx.insert(auditLogs).values({ userId, actorUserId: access.actorId, actorName: access.actorName, action: '办理续租', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo} 续租 ${values.reduce((sum, value) => sum + value.quantity, 0)} 台，新增应收 ${addedRent.toFixed(2)} 元`, metadata: { addedRent, endDate, itemCount: values.length } })
  }
  revalidatePath('/')
  revalidatePath('/audit-logs')
}

const renewalCorrectionSchema = z.object({ renewalRecordId: z.number().int().positive(), correctedUnitPrice: z.number().positive(), reason: z.string().trim().min(2, '请填写至少 2 个字的更正原因').max(200) })
export type RenewalCorrectionInput = z.infer<typeof renewalCorrectionSchema>

export async function correctRenewalPrice(input: RenewalCorrectionInput) {
  const access = await getAccessContext('租赁操作')
  if (access.role !== 'admin') throw new Error('仅店铺管理员可以更正续租价格')
  const value = renewalCorrectionSchema.parse(input)
  const userId = access.userId
  const [renewal] = await db.select().from(renewalRecords).where(and(eq(renewalRecords.id, value.renewalRecordId), eq(renewalRecords.userId, userId))).limit(1)
  if (!renewal) throw new Error('续租记录不存在或不属于当前店铺')
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, renewal.rentalId), eq(rentals.userId, userId))).limit(1)
  if (!rental) throw new Error('合同不存在或不属于当前店铺')
  assertOfficialRental(rental)
  const [latest] = await db.select().from(renewalAdjustments).where(and(eq(renewalAdjustments.userId, userId), eq(renewalAdjustments.renewalRecordId, renewal.id))).orderBy(desc(renewalAdjustments.createdAt), desc(renewalAdjustments.id)).limit(1)
  const previousUnitPrice = Number(latest?.correctedUnitPrice ?? renewal.unitPrice ?? renewal.newMonthlyRent)
  const duration = renewal.duration ?? renewal.renewalMonths ?? 1
  const previousAmount = Number(latest?.correctedAmount ?? renewal.renewalAmount)
  const adjustment = renewalAdjustment(renewal.quantity, duration, previousAmount, value.correctedUnitPrice)
  const correctedAmount = Number(adjustment.correctedAmount)
  const differenceAmount = Number(adjustment.differenceAmount)
  if (toCents(previousUnitPrice) === toCents(value.correctedUnitPrice) || toCents(differenceAmount) === 0) throw new Error('正确价格与当前有效价格相同，无需更正')
  const correctionDate = new Date().toISOString().slice(0, 10)
  const newTotalRent = Number((Number(rental.totalRent) + differenceAmount).toFixed(2))
  if (newTotalRent < 0) throw new Error('更正后合同总额不能小于 0')
  const paymentStatus = Number(rental.paidAmount) >= newTotalRent ? '已结清' : Number(rental.paidAmount) > 0 ? '部分收款' : '待收款'
  await db.batch([
    db.insert(renewalAdjustments).values({ userId, rentalId: renewal.rentalId, renewalRecordId: renewal.id, previousUnitPrice: fromCents(toCents(previousUnitPrice)), correctedUnitPrice: fromCents(toCents(value.correctedUnitPrice)), previousAmount: fromCents(toCents(previousAmount)), correctedAmount: fromCents(toCents(correctedAmount)), differenceAmount: fromCents(toCents(differenceAmount)), reason: value.reason, operatorUserId: access.actorId, operatorName: access.actorName }),
    db.insert(receivableBills).values({ userId, rentalId: renewal.rentalId, billNo: `RENEW-ADJ-${renewal.id}-${Date.now()}`, periodStart: renewal.oldEndDate, periodEnd: renewal.newEndDate, dueDate: correctionDate, billType: differenceAmount > 0 ? '续租补差' : '续租减免', amount: fromCents(toCents(differenceAmount)), paidAmount: '0', status: differenceAmount > 0 ? '待收' : '已调整', notes: `续租记录 #${renewal.id} 价格更正：${value.reason}` }),
    db.insert(rentalEvents).values({ userId, rentalId: renewal.rentalId, itemId: renewal.renewedRentalItemId, eventType: '续租价格更正', status: '已完成', eventDate: correctionDate, beforeSnapshot: { unitPrice: previousUnitPrice, amount: previousAmount }, afterSnapshot: { unitPrice: value.correctedUnitPrice, amount: correctedAmount }, reason: value.reason, feeAdjustment: fromCents(toCents(differenceAmount)), operatorName: access.actorName, notes: differenceAmount > 0 ? '生成续租补差应收' : '生成续租减免调整' }),
    db.update(rentals).set({ totalRent: fromCents(toCents(newTotalRent)), paymentStatus, updatedAt: new Date() }).where(and(eq(rentals.id, renewal.rentalId), eq(rentals.userId, userId))),
    db.insert(auditLogs).values({ userId, actorUserId: access.actorId, actorName: access.actorName, action: '更正续租价格', resourceType: '续租记录', resourceId: String(renewal.id), summary: `${rental.contractNo} 续租单价 ${previousUnitPrice.toFixed(2)} 元更正为 ${value.correctedUnitPrice.toFixed(2)} 元，差额 ${differenceAmount.toFixed(2)} 元`, metadata: { rentalId: renewal.rentalId, previousUnitPrice, correctedUnitPrice: value.correctedUnitPrice, previousAmount, correctedAmount, differenceAmount, reason: value.reason } }),
  ])
  revalidatePath('/')
  revalidatePath('/rentals')
  revalidatePath('/audit-logs')
  return { ok: true }
}

const paymentSchema = z.object({ amount: z.number().positive(), paymentDate: z.string().min(1), paymentMethod: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']), feeType: z.enum(['原合同租金', '续租费', '押金', '买断费', '其他']), billId: z.number().int().positive().optional(), renewalRecordId: z.number().int().positive().optional(), notes: z.string().optional() })
export type PaymentInput = z.infer<typeof paymentSchema>

export async function collectPayment(id: number, input: PaymentInput) {
  const userId = await getUserId()
  const value = paymentSchema.parse(input)
  const [row] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
  if (!row) throw new Error('记录不存在')
  assertOfficialRental(row)
  if (value.renewalRecordId) {
    const [renewal] = await db.select().from(renewalRecords).where(and(eq(renewalRecords.id, value.renewalRecordId), eq(renewalRecords.rentalId, id), eq(renewalRecords.userId, userId)))
    if (!renewal) throw new Error('续租记录不存在')
  }
  const billTypeFilter = value.feeType === '押金' ? eq(receivableBills.billType, '押金') : ne(receivableBills.billType, '押金')
  const bills = await db.select().from(receivableBills).where(and(eq(receivableBills.rentalId, id), eq(receivableBills.userId, userId), billTypeFilter)).orderBy(receivableBills.dueDate)
  if (value.billId && !bills.some(bill => bill.id === value.billId)) throw new Error('目标账单不存在、已变更或不属于当前合同')
  const availableCents = value.billId ? billOutstandingCents(bills.find(bill => bill.id === value.billId)!) : bills.reduce((sum, bill) => sum + billOutstandingCents(bill), 0)
  if (moneyToCents(value.amount) > availableCents) throw new Error(`收款金额超过当前待收金额，最多可收 ${centsToMoney(availableCents)} 元`)
  const allocations = allocatePayment(bills, value.amount, value.billId)
  const paymentId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.insert(paymentRecords).values({ id: paymentId, userId, rentalId: id, renewalRecordId: value.renewalRecordId, amount: String(value.amount), paymentDate: value.paymentDate, paymentMethod: value.paymentMethod, feeType: value.feeType, notes: value.notes }),
  ]
  if (value.feeType === '押金') statements.push(db.insert(accountLedger).values({ userId, rentalId: id, entryType: '押金收取', amount: String(value.amount), entryDate: value.paymentDate, paymentRecordId: paymentId, operatorName: '当前用户', notes: value.notes }))
  for (const allocation of allocations) {
    const bill = bills.find(item => item.id === allocation.billId)!
    const nextPaidCents = moneyToCents(bill.paidAmount) + allocation.amountCents
    statements.push(
      db.insert(paymentAllocations).values({ userId, rentalId: id, paymentRecordId: paymentId, billId: bill.id, amount: centsToMoney(allocation.amountCents) }),
      db.update(receivableBills).set({ paidAmount: centsToMoney(nextPaidCents), status: allocation.balanceAfterCents === 0 ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(receivableBills.id, bill.id), eq(receivableBills.userId, userId))),
    )
  }
  if (value.feeType !== '押金') {
    const paidCents = moneyToCents(row.paidAmount) + moneyToCents(value.amount)
    statements.push(db.update(rentals).set({ paidAmount: centsToMoney(paidCents), paymentStatus: paidCents >= moneyToCents(row.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId))))
  }
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
}

export async function reversePayment(paymentId: number, reason: string) {
  const userId = await getUserId()
  if (reason.trim().length < 2) throw new Error('请填写冲正原因')
  { const tx = db
    const [payment] = await tx.select().from(paymentRecords).where(and(eq(paymentRecords.id, paymentId), eq(paymentRecords.userId, userId)))
    if (!payment || Number(payment.amount) <= 0) throw new Error('原收款不存在或不可冲正')
    const existing = await tx.select().from(accountLedger).where(and(eq(accountLedger.paymentRecordId, paymentId), eq(accountLedger.entryType, '收款冲正'), eq(accountLedger.userId, userId)))
    if (existing.length) throw new Error('该收款已冲正')
    const [rental] = await tx.select().from(rentals).where(and(eq(rentals.id, payment.rentalId), eq(rentals.userId, userId)))
    if (!rental) throw new Error('合同不存在')
    const allocations = await tx.select().from(paymentAllocations).where(and(eq(paymentAllocations.paymentRecordId, paymentId), eq(paymentAllocations.userId, userId)))
    const allocatedBills = await Promise.all(allocations.map(async (allocation) => ({ allocation, bill: (await tx.select().from(receivableBills).where(and(eq(receivableBills.id, allocation.billId), eq(receivableBills.userId, userId))).limit(1))[0] })))
    if (allocatedBills.some(({ bill }) => !bill)) throw new Error('原收款的账单分配记录不完整，禁止冲正')
    const date = new Date().toISOString().slice(0, 10)
    const reversalId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
    const statements: Array<Parameters<typeof db.batch>[0][number]> = [
      ...allocatedBills.map(({ allocation, bill }) => {
        const nextPaidCents = Math.max(0, moneyToCents(bill!.paidAmount) - moneyToCents(allocation.amount))
        return tx.update(receivableBills).set({ paidAmount: centsToMoney(nextPaidCents), status: nextPaidCents === 0 ? '待收' : '部分收款', updatedAt: new Date() }).where(and(eq(receivableBills.id, bill!.id), eq(receivableBills.userId, userId)))
      }),
      tx.insert(paymentRecords).values({ id: reversalId, userId, rentalId: payment.rentalId, amount: centsToMoney(-moneyToCents(payment.amount)), paymentDate: date, paymentMethod: payment.paymentMethod, feeType: payment.feeType, notes: `冲正原收款 #${payment.id}：${reason}` }),
      tx.insert(accountLedger).values({ userId, rentalId: payment.rentalId, entryType: '收款冲正', amount: centsToMoney(-moneyToCents(payment.amount)), entryDate: date, paymentRecordId: payment.id, relatedEntryId: reversalId, operatorName: '当前用户', notes: reason }),
    ]
    if (payment.feeType !== '押金') {
      const paidCents = Math.max(0, moneyToCents(rental.paidAmount) - moneyToCents(payment.amount))
      statements.push(tx.update(rentals).set({ paidAmount: centsToMoney(paidCents), paymentStatus: paidCents <= 0 ? '待收款' : paidCents >= moneyToCents(rental.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, rental.id), eq(rentals.userId, userId))))
    }
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  }
  revalidatePath('/')
}

export async function recordDepositAction(rentalId: number, entryType: '押金退还' | '押金抵扣欠租' | '押金抵扣赔偿', amount: number, entryDate: string, notes = '') {
  const userId = await getUserId()
  if (amount <= 0 || !entryDate) throw new Error('请填写有效金额和日期')
  { const tx = db
    const [rental] = await tx.select().from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
    if (!rental) throw new Error('合同不存在')
    const entries = await tx.select().from(accountLedger).where(and(eq(accountLedger.rentalId, rentalId), eq(accountLedger.userId, userId)))
    const balance = entries.reduce((sum, entry) => sum + (entry.entryType === '押金收取' ? Number(entry.amount) : entry.entryType.startsWith('押金') ? -Math.abs(Number(entry.amount)) : 0), 0)
    if (amount > balance) throw new Error(`可用押金余额不足，当前为 ${balance.toFixed(2)} 元`)
    await tx.insert(accountLedger).values({ userId, rentalId, entryType, amount: String(-amount), entryDate, operatorName: '当前用户', notes })
    if (entryType !== '押金退还') {
      const paid = Number(fromCents(toCents(rental.paidAmount) + toCents(amount)))
      await tx.update(rentals).set({ paidAmount: String(paid), paymentStatus: paid >= Number(rental.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
    }
  }
  revalidatePath('/')
}

export async function buyoutRentalItem(rentalId: number, rentalItemId: number, quantity: number, unitPrice: number, buyoutDate: string, settlementInput: SettlementInput, notes = '') {
  const access = await getAccessContext('租赁操作')
  const userId = access.userId
  const settlement = settlementSchema.parse(settlementInput)
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('买断数量必须为正整数')
  if (unitPrice <= 0 || !buyoutDate) throw new Error('请填写有效的买断单价和日期')
  const [[item], allItems] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId))),
  ])
  if (!item) throw new Error('设备明细不存在')
  const remaining = availableQuantity(item)
  if (quantity > remaining) throw new Error(`最多可买断 ${remaining} 台`)
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
  if (!rental) throw new Error('租赁合同不存在')
  assertOfficialRental(rental)
  const amount = quantity * unitPrice
  const nextBought = item.boughtOutQuantity + quantity
  const nextItems = allItems.map(row => row.id === item.id ? { ...row, boughtOutQuantity: nextBought } : row)
  const nextTotal = Number(rental.totalRent) + amount
  const availableAfter = nextItems.reduce((sum, row) => sum + availableQuantity(row), 0)
  const buyoutId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const paidAmount = Number(rental.paidAmount) + (settlement.timing === 'now' ? amount : 0)
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(rentalItems).set({ boughtOutQuantity: nextBought, buyoutAmount: String(Number(item.buyoutAmount) + amount), updatedAt: new Date() }).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.userId, userId))),
    db.insert(buyoutRecords).values({ id: buyoutId, userId, rentalId, rentalItemId, quantity, unitPrice: String(unitPrice), amount: String(amount), buyoutDate, notes }),
    db.insert(receivableBills).values({ userId, rentalId, billNo: `BUYOUT-${rentalId}-${buyoutId}`, periodStart: buyoutDate, periodEnd: buyoutDate, dueDate: settlement.date, billType: '买断费', amount: String(amount), paidAmount: settlement.timing === 'now' ? String(amount) : '0', status: settlement.timing === 'now' ? '已结清' : '待收', notes: `${item.deviceName} ${quantity} 台买断；${settlement.timing === 'now' ? '本次已收款' : '约定以后收款'}` }),
    db.insert(rentalEvents).values({ userId, rentalId, itemId: rentalItemId, eventType: '买断', status: '已完成', eventDate: buyoutDate, beforeSnapshot: { availableQuantity: remaining }, afterSnapshot: { availableQuantity: remaining - quantity, boughtOutQuantity: nextBought, settlement: settlement.timing }, feeAdjustment: String(amount), operatorName: access.actorName, notes }),
    db.update(rentals).set({ quantity: availableAfter, totalRent: String(nextTotal), paidAmount: String(paidAmount), status: rentalLifecycleStatus(nextItems), paymentStatus: paidAmount >= nextTotal ? '已结清' : paidAmount > 0 ? '部分收款' : '待收款', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId))),
    db.insert(auditLogs).values({ userId, actorUserId: access.actorId, actorName: access.actorName, action: '办理买断', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo} 买断 ${item.deviceName} ${quantity} 台，${settlement.timing === 'now' ? '已收' : '待收'} ${amount.toFixed(2)} 元`, metadata: { rentalItemId, quantity, amount, settlement: settlement.timing } }),
  ]
  if (settlement.timing === 'now') statements.push(db.insert(paymentRecords).values({ userId, rentalId, buyoutRecordId: buyoutId, amount: String(amount), paymentDate: settlement.date, paymentMethod: settlement.method, feeType: '买断费', operatorName: access.actorName, notes: `${item.deviceName} ${quantity} 台买断即时收款` }))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
}

export type RentalFormSuggestions = {
  contacts: Array<{ name: string; phone: string; company: string; address: string }>
  configurations: Record<string, string[]>
  monitorBrands: string[]
}

export async function getRentalFormSuggestions(): Promise<RentalFormSuggestions> {
  const userId = await getUserId()
  const [contracts, items] = await Promise.all([
    db.select({ name: rentals.customerName, phone: rentals.customerPhone, company: rentals.customerCompany, address: rentals.customerAddress }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'))).orderBy(desc(rentals.createdAt)).limit(300),
    db.select({ deviceName: rentalItems.deviceName, deviceType: rentalItems.deviceType, cpu: rentalItems.cpu, motherboard: rentalItems.motherboard, memory: rentalItems.memory, storage: rentalItems.storage, graphicsCard: rentalItems.graphicsCard, powerSupply: rentalItems.powerSupply, caseModel: rentalItems.caseModel, monitorInfo: rentalItems.monitorInfo, screenSize: rentalItems.screenSize, screenResolution: rentalItems.screenResolution, refreshRate: rentalItems.refreshRate, panelType: rentalItems.panelType, ports: rentalItems.ports, batteryInfo: rentalItems.batteryInfo, adapterInfo: rentalItems.adapterInfo, accessories: rentalItems.accessories, colorGamut: rentalItems.colorGamut, deviceConfig: rentalItems.deviceConfig }).from(rentalItems).where(eq(rentalItems.userId, userId)).orderBy(desc(rentalItems.createdAt)).limit(500),
  ])
  const contactKeys = new Set<string>()
  const contacts = contracts.flatMap((row) => {
    const key = `${row.name.trim()}\u0000${row.phone.trim()}`
    if (!row.name.trim() || !row.phone.trim() || contactKeys.has(key)) return []
    contactKeys.add(key)
    return [{ name: row.name.trim(), phone: row.phone.trim(), company: row.company?.trim() ?? '', address: row.address?.trim() ?? '' }]
  }).slice(0, 100)
  const configurationKeys = ['cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut','deviceConfig'] as const
  const configurations = Object.fromEntries(configurationKeys.map((key) => [key, [...new Set(items.map((item) => item[key]?.trim()).filter((value): value is string => Boolean(value)))].slice(0, 30)]))
  const monitorBrands = [...new Set(items.flatMap((item) => item.deviceType === '显示器' && item.deviceName.trim() ? [item.deviceName.trim()] : []))].slice(0, 30)
  return { contacts, configurations, monitorBrands }
}

export async function getCustomerHistory(phone: string) {
  const userId = await getUserId()
  const normalized = phone.trim()
  if (!normalized) throw new Error('客户手机号不能为空')
  const contracts = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.customerPhone, normalized), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'))).orderBy(desc(rentals.createdAt))
  const ids = contracts.map((row) => row.id)
  if (!ids.length) return { contracts: [], renewals: [], payments: [], buyouts: [], returns: [], losses: [], events: [] }
  const [renewals, payments, buyouts, returns, losses, events] = await Promise.all([
  db.select().from(renewalRecords).where(and(eq(renewalRecords.userId, userId), inArray(renewalRecords.rentalId, ids))).orderBy(desc(renewalRecords.createdAt)),
  db.select().from(paymentRecords).where(and(eq(paymentRecords.userId, userId), inArray(paymentRecords.rentalId, ids))).orderBy(desc(paymentRecords.createdAt)),
  db.select().from(buyoutRecords).where(and(eq(buyoutRecords.userId, userId), inArray(buyoutRecords.rentalId, ids))).orderBy(desc(buyoutRecords.createdAt)),
  db.select().from(returnRecords).where(and(eq(returnRecords.userId, userId), inArray(returnRecords.rentalId, ids))).orderBy(desc(returnRecords.createdAt)),
  db.select().from(lossRecords).where(and(eq(lossRecords.userId, userId), inArray(lossRecords.rentalId, ids))).orderBy(desc(lossRecords.createdAt)),
  db.select().from(rentalEvents).where(and(eq(rentalEvents.userId, userId), inArray(rentalEvents.rentalId, ids))).orderBy(desc(rentalEvents.createdAt)),
  ])
  return { contracts, renewals, payments, buyouts, returns, losses, events }
}

export async function changeStatus(id: number, status: string) {
  const access = await getAccessContext('租赁操作')
  if (!['在租', '逾期', '丢失', '已关闭'].includes(status)) throw new Error('无效状态')
  if (status === '已关闭' && access.role === 'employee') throw new Error('只有管理员可以关闭订单')
  const [rental] = await db.select({ id: rentals.id, orderType: rentals.orderType, lifecycleStatus: rentals.lifecycleStatus }).from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId)))
  if (!rental) throw new Error('订单不存在')
  assertOfficialRental(rental)
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(rentals).set({ status, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId))),
    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '变更状态', resourceType: '租赁合同', resourceId: String(id), summary: `合同状态变更为 ${status}`, metadata: { status } }),
  ]
  if (status === '已关闭') statements.push(db.insert(rentalEvents).values({ userId: access.userId, rentalId: id, eventType: '管理员关闭订单', status: '已完成', eventDate: new Date().toISOString().slice(0, 10), operatorName: access.actorName, reason: '测试或无效订单关闭' }))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
}

const trashRentalSchema = z.object({
  id: z.coerce.number().int().positive(),
  reason: z.string().trim().min(4, '请填写至少 4 个字的删除原因').max(200),
  adminPassword: z.string().max(200).optional(),
})

export async function moveRentalToTrash(input: number | z.input<typeof trashRentalSchema>, legacyReason = '测试或草稿数据清理') {
  const value = trashRentalSchema.parse(typeof input === 'number' ? { id: input, reason: legacyReason } : input)
  const access = await getAccessContext('租赁操作')
  if (access.role === 'employee') throw new Error('只有管理员可以移入回收站')
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, value.id), eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'active')))
  if (!rental) throw new Error('订单不存在或已在回收站')

  if (rental.orderType === 'official') {
    if (access.role !== 'admin') throw new Error('只有店铺管理员可以删除当天录错的正式订单')
    assertSameDayOfficialRental(rental.createdAt)
    if (!value.adminPassword) throw new Error('请输入当前管理员登录密码')
    try {
      const verified = await auth.api.verifyPassword({ body: { password: value.adminPassword }, headers: await headers() })
      if (!verified.status) throw new Error('invalid')
    } catch {
      throw new Error('管理员密码错误，无法删除订单')
    }
    const related = await Promise.all([
      db.select({ id: paymentRecords.id }).from(paymentRecords).where(and(eq(paymentRecords.rentalId, value.id), eq(paymentRecords.userId, access.userId))).limit(1),
      db.select({ id: paymentAllocations.id }).from(paymentAllocations).where(and(eq(paymentAllocations.rentalId, value.id), eq(paymentAllocations.userId, access.userId))).limit(1),
      db.select({ id: accountLedger.id }).from(accountLedger).where(and(eq(accountLedger.rentalId, value.id), eq(accountLedger.userId, access.userId))).limit(1),
      db.select({ id: buyoutRecords.id }).from(buyoutRecords).where(and(eq(buyoutRecords.rentalId, value.id), eq(buyoutRecords.userId, access.userId))).limit(1),
      db.select({ id: renewalRecords.id }).from(renewalRecords).where(and(eq(renewalRecords.rentalId, value.id), eq(renewalRecords.userId, access.userId))).limit(1),
      db.select({ id: renewalAdjustments.id }).from(renewalAdjustments).where(and(eq(renewalAdjustments.rentalId, value.id), eq(renewalAdjustments.userId, access.userId))).limit(1),
      db.select({ id: returnRecords.id }).from(returnRecords).where(and(eq(returnRecords.rentalId, value.id), eq(returnRecords.userId, access.userId))).limit(1),
      db.select({ id: lossRecords.id }).from(lossRecords).where(and(eq(lossRecords.rentalId, value.id), eq(lossRecords.userId, access.userId))).limit(1),
      db.select({ id: rentalEvents.id }).from(rentalEvents).where(and(eq(rentalEvents.rentalId, value.id), eq(rentalEvents.userId, access.userId))).limit(1),
    ])
    assertNoRentalActivity(related.map((rows) => rows.length))
  } else if (rental.orderType === 'test' && Date.now() - rental.createdAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new Error('测试合同创建已超过 24 小时，不能移入回收站')
  }

  await db.batch([
    db.update(rentals).set({ lifecycleStatus: 'trash', deletedAt: new Date(), deletedBy: access.actorId, deleteReason: value.reason, updatedAt: new Date() }).where(and(eq(rentals.id, value.id), eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'active'))),
    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '移入回收站', resourceType: '租赁合同', resourceId: String(value.id), summary: `将${rental.orderType === 'official' ? '当天录错的正式' : rental.orderType === 'test' ? '测试' : '草稿'}合同 ${rental.contractNo} 移入回收站`, metadata: { reason: value.reason, orderType: rental.orderType, customerName: rental.customerName, ruleVersion: rental.orderType === 'official' ? 'same-day-official-v1' : 'standard-v1' } }),
  ])
  revalidatePath('/')
  revalidatePath('/rentals')
}

export async function restoreRental(id: number) {
  const access = await getAccessContext('租赁操作')
  if (access.role === 'employee') throw new Error('只有管理员可以恢复订单')
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'trash')))
  if (!rental) throw new Error('回收站中不存在该订单')
  await db.batch([
    db.update(rentals).set({ lifecycleStatus: 'active', deletedAt: null, deletedBy: null, deleteReason: null, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId))),
    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '恢复', resourceType: '租赁合同', resourceId: String(id), summary: `从回收站恢复合同 ${rental.contractNo}`, metadata: { orderType: rental.orderType } }),
  ])
  revalidatePath('/rentals')
}

export async function permanentlyDeleteRental(id: number) {
  const access = await getAccessContext('租赁操作')
  if (access.role === 'employee') throw new Error('只有管理员可以彻底删除订单')
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'trash')))
  if (!rental || rental.orderType === 'official') throw new Error('仅回收站中的草稿或测试合同可彻底删除')
  const related = await Promise.all([
    db.select({ id: paymentRecords.id }).from(paymentRecords).where(and(eq(paymentRecords.rentalId, id), eq(paymentRecords.userId, access.userId))).limit(1),
    db.select({ id: buyoutRecords.id }).from(buyoutRecords).where(and(eq(buyoutRecords.rentalId, id), eq(buyoutRecords.userId, access.userId))).limit(1),
    db.select({ id: renewalRecords.id }).from(renewalRecords).where(and(eq(renewalRecords.rentalId, id), eq(renewalRecords.userId, access.userId))).limit(1),
    db.select({ id: returnRecords.id }).from(returnRecords).where(and(eq(returnRecords.rentalId, id), eq(returnRecords.userId, access.userId))).limit(1),
    db.select({ id: lossRecords.id }).from(lossRecords).where(and(eq(lossRecords.rentalId, id), eq(lossRecords.userId, access.userId))).limit(1),
    db.select({ id: rentalEvents.id }).from(rentalEvents).where(and(eq(rentalEvents.rentalId, id), eq(rentalEvents.userId, access.userId))).limit(1),
    db.select({ id: accountLedger.id }).from(accountLedger).where(and(eq(accountLedger.rentalId, id), eq(accountLedger.userId, access.userId))).limit(1),
  ])
  if (related.some((rows) => rows.length)) throw new Error('该订单已有业务或资金关联记录，不能彻底删除')
  await db.batch([
    db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '彻底删除', resourceType: '租赁合同', resourceId: String(id), summary: `彻底删除合同 ${rental.contractNo}`, metadata: { customerName: rental.customerName, orderType: rental.orderType } }),
    db.delete(receivableBills).where(and(eq(receivableBills.rentalId, id), eq(receivableBills.userId, access.userId))),
    db.delete(contractSnapshots).where(and(eq(contractSnapshots.rentalId, id), eq(contractSnapshots.userId, access.userId))),
    db.delete(rentalItems).where(and(eq(rentalItems.rentalId, id), eq(rentalItems.userId, access.userId))),
    db.delete(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId))),
  ])
  revalidatePath('/rentals')
}

export const deleteTestRental = moveRentalToTrash

async function confirmDraftOperation(id: number, access: Awaited<ReturnType<typeof getAccessContext>>) {
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'active')))
  if (!rental) throw new Error('订单不存在或已删除')
  if (rental.orderType === 'official') throw new Error('该合同已经是正式合同')
  if (rental.orderType === 'test') throw new Error('测试合同不能转为正式合同')
  const items = await db.select().from(rentalItems).where(and(eq(rentalItems.rentalId, id), eq(rentalItems.userId, access.userId))).orderBy(rentalItems.id)
  if (!items.length) throw new Error('草稿缺少设备明细，无法转正式')
  const numbers = await getNextRentalNumbers(rental.startDate, items.map((item) => ({ deviceType: item.deviceType as RentalItemInput['deviceType'], quantity: item.quantity })))
  const monthlyRent = Number(rental.monthlyRent)
  const totalRent = Number(rental.totalRent)
  // 计费方式以主表字段为准；旧数据迁移前可能仍只有备注文本，故保留兼容判断。
  const isDaily = rental.billingType ? rental.billingType === 'daily' : (rental.notes || '').includes('日租')
  const bills = isDaily
    ? [{ rentalId: id, billNo: `${numbers.contractNo}-001`, periodStart: rental.startDate, periodEnd: rental.endDate, dueDate: rental.startDate, amount: totalRent.toFixed(2), billType: '日租租金', status: '待收' }]
    : buildPrepaidRentBill(id, numbers.contractNo, rental.startDate, rental.endDate, totalRent, rental.duration)
  const deposit = Number(rental.deposit)
  const allBills = deposit > 0 ? [...bills, { rentalId: id, billNo: `${numbers.contractNo}-DEP`, periodStart: rental.startDate, periodEnd: rental.startDate, dueDate: rental.startDate, amount: deposit.toFixed(2), billType: '押金', status: '待收' }] : bills
  try {
    const statements: Array<Parameters<typeof db.batch>[0][number]> = [
      db.update(rentals).set({ orderType: 'official', contractNo: numbers.contractNo, deviceCode: numbers.deviceCodes[0], confirmedAt: new Date(), confirmedBy: access.actorId, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId))),
      ...items.map((item, index) => db.update(rentalItems).set({ deviceCode: numbers.deviceCodes[index], updatedAt: new Date() }).where(and(eq(rentalItems.id, item.id), eq(rentalItems.userId, access.userId)))),
      ...buildBillInsertStatements(allBills, access.userId),
      db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '转正式合同', resourceType: '租赁合同', resourceId: String(id), summary: `草稿合同转为正式合同 ${numbers.contractNo}`, metadata: { totalRent, contractNo: numbers.contractNo } }),
    ]
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  } catch (error) {
    const cause = typeof error === 'object' && error && 'cause' in error ? error.cause : error
    if (typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505') throw new Error(`合同编号“${numbers.contractNo}”已存在，请重试`)
    throw error
  }
  revalidatePath('/')
  revalidatePath('/rentals')
  return numbers.contractNo
}

export async function confirmDraftAsOfficial(id: number) {
  return toActionResult('草稿转正式合同', async () => {
    const access = await getAccessContext('租赁操作')
    return confirmDraftOperation(id, access)
  })
}

export type DraftConfirmOutcome = { id: number; contractNo: string | null; message: string }

/**
 * 批量转正必须串行执行：合同号与设备编号都按当日流水号推导，
 * 并发调用会读到同一个基准值并产生重复编号。
 */
export async function confirmDraftsAsOfficial(ids: number[]) {
  return toActionResult('批量转正式合同', async () => {
    const access = await getAccessContext('租赁操作')
    const unique = [...new Set(z.array(z.coerce.number().int().positive()).min(1, '请先勾选草稿').max(DRAFT_IMPORT_LIMIT).parse(ids))]
    const succeeded: DraftConfirmOutcome[] = []
    const failed: DraftConfirmOutcome[] = []
    for (const id of unique) {
      try {
        const contractNo = await confirmDraftOperation(id, access)
        succeeded.push({ id, contractNo, message: '' })
      } catch (error) {
        failed.push({ id, contractNo: null, message: safeError(error).message })
      }
    }
    return { succeeded, failed }
  })
}

const draftImportSchema = z.object({
  rows: z.array(rentalSchema).min(1, '没有可导入的数据').max(DRAFT_IMPORT_LIMIT, `单次最多导入 ${DRAFT_IMPORT_LIMIT} 行`),
  assigneeUserId: z.string().optional(),
})

export type DraftImportPayload = z.input<typeof draftImportSchema>

/** 批量导入草稿：逐行独立提交，单行失败不影响其余行，并回传行号便于业务人员修正。 */
export async function importDraftRentals(payload: DraftImportPayload) {
  return toActionResult('批量导入草稿', async () => {
    await getAccessContext('租赁操作')
    const value = draftImportSchema.parse(payload)
    const succeeded: number[] = []
    const failed: Array<{ line: number; message: string }> = []
    for (const [index, row] of value.rows.entries()) {
      try {
        const rentalId = await createRentalOperation({ ...row, contractNo: '', assigneeUserId: row.assigneeUserId || value.assigneeUserId }, 'draft')
        succeeded.push(rentalId)
      } catch (error) {
        failed.push({ line: index + 1, message: safeError(error).message })
      }
    }
    revalidatePath('/rentals')
    revalidatePath('/rentals/drafts')
    return { succeeded, failed }
  })
}

export async function getDraftRentalDetail(id: number) {
  const userId = await getUserId()
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, userId), eq(rentals.orderType, 'draft'), eq(rentals.lifecycleStatus, 'active')))
  if (!rental) return null
  const items = await db.select().from(rentalItems).where(and(eq(rentalItems.rentalId, id), eq(rentalItems.userId, userId))).orderBy(rentalItems.id)
  return { ...rental, createdAt: rental.createdAt.toISOString(), confirmedAt: null, deletedAt: null, items }
}

export async function getRentalTrash() {
  const userId = await getUserId()
  const rows = await db.select({ id: rentals.id, orderType: rentals.orderType, contractNo: rentals.contractNo, customerName: rentals.customerName, customerCompany: rentals.customerCompany, deviceName: rentals.deviceName, totalRent: rentals.totalRent, deletedAt: rentals.deletedAt, deletedBy: rentals.deletedBy, deleteReason: rentals.deleteReason }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.lifecycleStatus, 'trash'))).orderBy(desc(rentals.deletedAt)).limit(200)
  return rows.map((row) => {
    const deletedMs = row.deletedAt ? row.deletedAt.getTime() : Date.now()
    const remainingDays = Math.max(0, 30 - Math.floor((Date.now() - deletedMs) / (24 * 60 * 60 * 1000)))
    return { ...row, deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null, remainingDays }
  })
}
