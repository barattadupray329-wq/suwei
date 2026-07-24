'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, buyoutRecords, contractSnapshots, lossRecords, organizationMembers, paymentAllocations, paymentRecords, receivableBills, renewalRecords, rentalEvents, rentalItems, rentals, returnRecords, user } from '@/lib/db/schema'
import { fromCents, rentalEndDate, renewalAmount, toCents } from '@/lib/rental-calculations'
import { buildRentalNumbers, normalizeRentalDate } from '@/lib/rental-numbers'
import { normalizeDeviceName, normalizeStartDateReason, START_DATE_REASONS, validateRentalItemFields } from '@/lib/rental-form-rules'
import { toActionResult } from '@/lib/action-result'
import { availableQuantity } from '@/lib/rental-lifecycle'

async function getUserId() {
  return (await getAccessContext('租赁操作')).userId
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

export async function getRentals(query = '', status = '全部') {
  const userId = await getUserId()
  const filters = [eq(rentals.userId, userId)]
  if (query) filters.push(or(like(rentals.contractNo, `%${query}%`), like(rentals.customerCompany, `%${query}%`), like(rentals.customerName, `%${query}%`), like(rentals.customerPhone, `%${query}%`), like(rentals.deviceName, `%${query}%`))!)
  if (status !== '全部') filters.push(eq(rentals.status, status))
  const rows = await db.select().from(rentals).where(and(...filters)).orderBy(desc(rentals.createdAt))
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const [items, buyouts, renewals, payments, events, bills, ledger] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, ids))).orderBy(rentalItems.id),
    db.select().from(buyoutRecords).where(and(eq(buyoutRecords.userId, userId), inArray(buyoutRecords.rentalId, ids))).orderBy(desc(buyoutRecords.createdAt)),
    db.select().from(renewalRecords).where(and(eq(renewalRecords.userId, userId), inArray(renewalRecords.rentalId, ids))).orderBy(desc(renewalRecords.createdAt)),
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
  const renewalMap = groupByRental(renewals)
  const paymentMap = groupByRental(payments)
  const eventMap = groupByRental(events)
  const billMap = groupByRental(bills)
  const ledgerMap = groupByRental(ledger)
  return rows.map((row) => ({ ...row, items: itemMap.get(row.id) ?? [], buyoutRecords: buyoutMap.get(row.id) ?? [], renewalRecords: renewalMap.get(row.id) ?? [], paymentRecords: paymentMap.get(row.id) ?? [], events: eventMap.get(row.id) ?? [], bills: billMap.get(row.id) ?? [], ledger: ledgerMap.get(row.id) ?? [] }))
}

export async function getDashboard() {
  const userId = await getUserId()
  const [summary] = await db.select({ total: sql<number>`count(*)`, active: sql<number>`coalesce(sum(case when ${rentals.status} in ('在租', '逾期', '部分买断', '部分退租', '部分丢失', '丢失') then 1 else 0 end), 0)`, overdue: sql<number>`coalesce(sum(case when ${rentals.status} = '逾期' or (${rentals.endDate} < current_date and ${rentals.status} in ('在租', '部分买断', '部分退租', '部分丢失')) then 1 else 0 end), 0)`, revenue: sql<string>`coalesce((select sum(${paymentRecords.amount}) from ${paymentRecords} where ${paymentRecords.userId} = ${userId}), 0)`, receivable: sql<string>`coalesce((select sum(max(${receivableBills.amount} - ${receivableBills.paidAmount}, 0)) from ${receivableBills} where ${receivableBills.userId} = ${userId} and ${receivableBills.status} not in ('已结清', '已调整')), 0)` }).from(rentals).where(eq(rentals.userId, userId))
  return summary
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

function buildMonthlyBills(rentalId: number, contractNo: string, startDate: string, endDate: string, totalRent: number, monthlyRent: number) {
  const result: Array<{ rentalId: number; billNo: string; periodStart: string; periodEnd: string; dueDate: string; amount: string; billType: string; status: string }> = []
  let periodStart = startDate
  let index = 1
  let remaining = Math.round(totalRent * 100)
  while (periodStart <= endDate && remaining > 0) {
    const nextMonth = addCalendarMonths(periodStart, 1)
    const periodEnd = addCalendarDays(nextMonth, -1) < endDate ? addCalendarDays(nextMonth, -1) : endDate
    const amount = Math.min(remaining, Math.round(monthlyRent * 100))
    result.push({ rentalId, billNo: `${contractNo}-${String(index).padStart(3, '0')}`, periodStart, periodEnd, dueDate: periodStart, amount: (amount / 100).toFixed(2), billType: '租金', status: '待收' })
    remaining -= amount
    periodStart = addCalendarDays(periodEnd, 1)
    index += 1
  }
  return result
}

async function createRentalOperation(input: RentalInput) {
  const access = await getAccessContext('租赁操作')
  const userId = access.userId
  const value = rentalSchema.parse(input)
  const assignee = await resolveRentalAssignee(access, value.assigneeUserId)
  const startDateReason = normalizeStartDateReason(value.startDate, value.startDateReason)
  const itemError = value.items.map(validateRentalItemFields).find(Boolean)
  if (itemError) throw new Error(itemError)
  const expectedEndDate = rentalEndDate(value.startDate, value.duration, value.billingType)
  if (value.endDate !== expectedEndDate) throw new Error('到期日期与计费方式、起租日期或租赁时间不一致')
  const numbers = await getNextRentalNumbers(value.startDate, value.items)
  const normalizedItems = value.items.map((item, index) => ({
    ...item,
    deviceName: normalizeDeviceName(item.deviceType, item.deviceName),
    deviceCode: numbers.deviceCodes[index],
    totalRent: Math.round(item.quantity * item.monthlyRent * value.duration * 100) / 100,
  }))
  const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0)
  const monthlyRent = normalizedItems.reduce((sum, item) => sum + item.monthlyRent * item.quantity, 0)
  const totalRent = normalizedItems.reduce((sum, item) => sum + item.totalRent, 0)
  try {
    const first = value.items[0]
    // D1 不支持交互式事务；预先生成有序且低碰撞的安全整数 ID，随后用 batch 原子提交全部关联记录。
    const rentalId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
    const bills = value.billingType === 'daily'
      ? [{ rentalId, billNo: `${numbers.contractNo}-001`, periodStart: value.startDate, periodEnd: value.endDate, dueDate: value.startDate, amount: totalRent.toFixed(2), billType: '日租租金', status: '待收' }]
      : buildMonthlyBills(rentalId, numbers.contractNo, value.startDate, value.endDate, totalRent, monthlyRent)
    const allBills = value.deposit > 0 ? [...bills, { rentalId, billNo: `${numbers.contractNo}-DEP`, periodStart: value.startDate, periodEnd: value.startDate, dueDate: value.startDate, amount: value.deposit.toFixed(2), billType: '押金', status: '待收' }] : bills
    const statements = [
      db.insert(rentals).values({ id: rentalId, userId, sourceUserId: access.actorId, sourceName: access.actorName, assigneeUserId: assignee.id, assigneeName: assignee.name, contractNo: numbers.contractNo, customerCompany: value.customerCompany?.trim() || null, customerName: value.customerName, customerPhone: value.customerPhone, customerAddress: value.customerAddress, startDate: value.startDate, startDateReason, endDate: value.endDate, deposit: String(value.deposit), notes: [`计费方式：${value.billingType === 'daily' ? '日租' : '月租'}；租赁时间：${value.duration}${value.billingType === 'daily' ? '天' : '个月'}`, value.notes?.trim()].filter(Boolean).join('\n'), deviceName: normalizedItems.map((item) => item.deviceName).join('、'), deviceType: normalizedItems.length > 1 ? '多设备' : first.deviceType, deviceCode: normalizedItems[0].deviceCode, deviceConfig: first.deviceConfig, quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), paidAmount: '0', paymentStatus: '待收款', status: '在租' }),
      db.insert(rentalItems).values(normalizedItems.map((item) => ({ ...item, userId, rentalId, startDate: value.startDate, endDate: value.endDate, monthlyRent: String(item.monthlyRent), totalRent: String(item.totalRent) }))),
      ...(allBills.length ? [db.insert(receivableBills).values(allBills.map((bill) => ({ ...bill, userId })))] : []),
      db.insert(auditLogs).values({ userId, actorUserId: access.actorId, actorName: access.actorName, action: '创建', resourceType: '租赁合同', resourceId: String(rentalId), summary: `创建合同 ${numbers.contractNo}（${value.customerCompany || value.customerName}）`, metadata: { totalRent, quantity } }),
    ]
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  } catch (error) {
    const cause = typeof error === 'object' && error && 'cause' in error ? error.cause : error
    if (typeof cause === 'object' && cause && 'code' in cause && cause.code === '23505') throw new Error(`合同编号“${numbers.contractNo}”已存在，请更换后再保存`)
    throw error
  }
  revalidatePath('/')
}

export async function createRental(input: RentalInput) {
  return toActionResult('创建租赁合同', () => createRentalOperation(input))
}

export async function updateRentalAssignee(rentalId: number, assigneeUserId: string) {
  const access = await getAccessContext('合同管理')
  if (access.role === 'employee') throw new Error('仅管理员可调整维护负责人')
  const assignee = await resolveRentalAssignee(access, assigneeUserId)
  const [rental] = await db.select({ id: rentals.id, contractNo: rentals.contractNo, assigneeName: rentals.assigneeName }).from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId)))
  if (!rental) throw new Error('租赁合同不存在')
  await db.update(rentals).set({ assigneeUserId: assignee.id, assigneeName: assignee.name, updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, access.userId)))
  await db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '调整负责人', resourceType: '租赁合同', resourceId: String(rentalId), summary: `${rental.contractNo}：${rental.assigneeName || '未分配'} → ${assignee.name}`, metadata: { previousAssignee: rental.assigneeName, assigneeUserId: assignee.id, assigneeName: assignee.name } })
  revalidatePath('/dashboard')
}

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

export async function renewRentalItems(rentalId: number, inputs: RenewalInput[]) {
  const userId = await getUserId()
  const values = z.array(renewalSchema).min(1, '请至少选择一项设备').parse(inputs)
  { const tx = db
    const [rental] = await tx.select().from(rentals).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
    if (!rental) throw new Error('租赁合同不存在')
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
      await tx.insert(renewalRecords).values({ userId, rentalId, sourceRentalItemId: item.id, renewedRentalItemId: renewedItemId, quantity: value.quantity, renewalMonths: value.billingUnit === 'month' ? value.duration : null, billingUnit: value.billingUnit, duration: value.duration, unitPrice: String(value.unitPrice), oldMonthlyRent: item.monthlyRent, newMonthlyRent: String(effectiveMonthlyRent), oldEndDate, newEndDate, renewalAmount: String(amount), renewalDate: new Date().toISOString().slice(0, 10), notes: value.notes })
    }
    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const active = allItems.filter((item) => availableQuantity(item) > 0)
    const quantity = active.reduce((sum, item) => sum + availableQuantity(item), 0)
    const monthlyRent = active.reduce((sum, item) => sum + Number(item.monthlyRent) * availableQuantity(item), 0)
    const totalRent = Number(rental.totalRent) + addedRent
    const endDate = active.map((item) => item.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate
    const status = rental.status === '逾期' ? '在租' : rental.status
    await tx.update(rentals).set({ quantity, monthlyRent: String(monthlyRent), totalRent: String(totalRent), endDate, status, updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
  }
  revalidatePath('/')
}

const paymentSchema = z.object({ amount: z.number().positive(), paymentDate: z.string().min(1), paymentMethod: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']), feeType: z.enum(['原合同租金', '续租费', '押金', '买断费', '其他']), renewalRecordId: z.number().int().positive().optional(), notes: z.string().optional() })
export type PaymentInput = z.infer<typeof paymentSchema>

export async function collectPayment(id: number, input: PaymentInput) {
  const userId = await getUserId()
  const value = paymentSchema.parse(input)
  { const tx = db
    const [row] = await tx.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
    if (!row) throw new Error('记录不存在')
    if (value.renewalRecordId) {
      const [renewal] = await tx.select().from(renewalRecords).where(and(eq(renewalRecords.id, value.renewalRecordId), eq(renewalRecords.rentalId, id), eq(renewalRecords.userId, userId)))
      if (!renewal) throw new Error('续租记录不存在')
    }
    const billTypeFilter = value.feeType === '押金' ? eq(receivableBills.billType, '押金') : ne(receivableBills.billType, '押金')
    const bills = await tx.select().from(receivableBills).where(and(eq(receivableBills.rentalId, id), eq(receivableBills.userId, userId), billTypeFilter)).orderBy(receivableBills.dueDate)
    const outstandingCents = bills.reduce((sum, bill) => sum + Math.max(0, toCents(bill.amount) - toCents(bill.paidAmount)), 0)
    if (toCents(value.amount) > outstandingCents) throw new Error(`收款金额超过当前待收金额，最多可收 ${fromCents(outstandingCents)} 元`)
    const [payment] = await tx.insert(paymentRecords).values({ userId, rentalId: id, renewalRecordId: value.renewalRecordId, amount: String(value.amount), paymentDate: value.paymentDate, paymentMethod: value.paymentMethod, feeType: value.feeType, notes: value.notes }).returning({ id: paymentRecords.id })
    if (value.feeType === '押金') {
      await tx.insert(accountLedger).values({ userId, rentalId: id, entryType: '押金收取', amount: String(value.amount), entryDate: value.paymentDate, paymentRecordId: payment.id, operatorName: '当前用户', notes: value.notes })
    }
    let remaining = Math.round(value.amount * 100)
    {

      for (const bill of bills) {
        const outstanding = Math.max(0, Math.round((Number(bill.amount) - Number(bill.paidAmount)) * 100))
        const allocated = Math.min(remaining, outstanding)
        if (allocated <= 0) continue
        const nextPaid = Math.round(Number(bill.paidAmount) * 100) + allocated
        await tx.insert(paymentAllocations).values({ userId, rentalId: id, paymentRecordId: payment.id, billId: bill.id, amount: (allocated / 100).toFixed(2) })
        await tx.update(receivableBills).set({ paidAmount: (nextPaid / 100).toFixed(2), status: nextPaid >= Math.round(Number(bill.amount) * 100) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(receivableBills.id, bill.id), eq(receivableBills.userId, userId)))
        remaining -= allocated
        if (remaining <= 0) break
      }
    }
    if (value.feeType !== '押金') {
      const paid = Number(fromCents(toCents(row.paidAmount) + toCents(value.amount)))
      await tx.update(rentals).set({ paidAmount: String(paid), paymentStatus: paid >= Number(row.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, userId)))
    }
  }
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
    for (const allocation of allocations) {
      const [bill] = await tx.select().from(receivableBills).where(and(eq(receivableBills.id, allocation.billId), eq(receivableBills.userId, userId)))
      if (!bill) continue
      const nextPaid = Math.max(0, Number(bill.paidAmount) - Number(allocation.amount))
      await tx.update(receivableBills).set({ paidAmount: String(nextPaid), status: nextPaid <= 0 ? '待收' : '部分收款', updatedAt: new Date() }).where(and(eq(receivableBills.id, bill.id), eq(receivableBills.userId, userId)))
    }
    const date = new Date().toISOString().slice(0, 10)
    await tx.insert(paymentRecords).values({ userId, rentalId: payment.rentalId, amount: String(-Number(payment.amount)), paymentDate: date, paymentMethod: payment.paymentMethod, feeType: payment.feeType, notes: `冲正原收款 #${payment.id}：${reason}` })
    await tx.insert(accountLedger).values({ userId, rentalId: payment.rentalId, entryType: '收款冲正', amount: String(-Number(payment.amount)), entryDate: date, paymentRecordId: payment.id, operatorName: '当前用户', notes: reason })
    if (payment.feeType !== '押金') {
      const paid = Number(fromCents(Math.max(0, toCents(rental.paidAmount) - toCents(payment.amount))))
      await tx.update(rentals).set({ paidAmount: String(paid), paymentStatus: paid <= 0 ? '待收款' : paid >= Number(rental.totalRent) ? '已结清' : '部分收款', updatedAt: new Date() }).where(and(eq(rentals.id, rental.id), eq(rentals.userId, userId)))
    }
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

export async function buyoutRentalItem(rentalId: number, rentalItemId: number, quantity: number, unitPrice: number, buyoutDate: string, notes = '') {
  const userId = await getUserId()
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('买断数量必须为正整数')
  if (unitPrice <= 0 || !buyoutDate) throw new Error('请填写有效的买断单价和日期')
  { const tx = db
    const [item] = await tx.select().from(rentalItems).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    if (!item) throw new Error('设备明细不存在')
    const remaining = availableQuantity(item)
    if (quantity > remaining) throw new Error(`最多可买断 ${remaining} 台`)
    const amount = quantity * unitPrice
    await tx.update(rentalItems).set({ boughtOutQuantity: item.boughtOutQuantity + quantity, buyoutAmount: String(Number(item.buyoutAmount) + amount), updatedAt: new Date() }).where(and(eq(rentalItems.id, rentalItemId), eq(rentalItems.userId, userId)))
    await tx.insert(buyoutRecords).values({ userId, rentalId, rentalItemId, quantity, unitPrice: String(unitPrice), amount: String(amount), buyoutDate, notes })
    const allItems = await tx.select().from(rentalItems).where(and(eq(rentalItems.rentalId, rentalId), eq(rentalItems.userId, userId)))
    const bought = allItems.reduce((sum, row) => sum + (row.id === item.id ? item.boughtOutQuantity + quantity : row.boughtOutQuantity), 0)
    const total = allItems.reduce((sum, row) => sum + row.quantity, 0)
    await tx.update(rentals).set({ status: bought >= total ? '买断' : '部分买断', updatedAt: new Date() }).where(and(eq(rentals.id, rentalId), eq(rentals.userId, userId)))
  }
  revalidatePath('/')
}

export async function getCustomerHistory(phone: string) {
  const userId = await getUserId()
  const normalized = phone.trim()
  if (!normalized) throw new Error('客户手机号不能为空')
  const contracts = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.customerPhone, normalized))).orderBy(desc(rentals.createdAt))
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
  const [rental] = await db.select({ id: rentals.id }).from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId)))
  if (!rental) throw new Error('订单不存在')
  { const tx = db
    await tx.update(rentals).set({ status, updatedAt: new Date() }).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId)))
    if (status === '已关闭') await tx.insert(rentalEvents).values({ userId: access.userId, rentalId: id, eventType: '管理员关闭订单', status: '已完成', eventDate: new Date().toISOString().slice(0, 10), operatorName: access.actorName, reason: '测试或无效订单关闭' })
    await tx.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '变更状态', resourceType: '租赁合同', resourceId: String(id), summary: `合同状态变更为 ${status}`, metadata: { status } })
  }
  revalidatePath('/')
}

export async function deleteTestRental(id: number) {
  const access = await getAccessContext('租赁操作')
  if (access.role === 'employee') throw new Error('只有管理员可以删除测试订单')
  { const tx = db
    const [rental] = await tx.select().from(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId)))
    if (!rental) throw new Error('订单不存在')
    const [payments, buyouts, renewals, returns, losses, events, ledger] = await Promise.all([
      tx.select({ id: paymentRecords.id }).from(paymentRecords).where(and(eq(paymentRecords.rentalId, id), eq(paymentRecords.userId, access.userId))),
      tx.select({ id: buyoutRecords.id }).from(buyoutRecords).where(and(eq(buyoutRecords.rentalId, id), eq(buyoutRecords.userId, access.userId))),
      tx.select({ id: renewalRecords.id }).from(renewalRecords).where(and(eq(renewalRecords.rentalId, id), eq(renewalRecords.userId, access.userId))),
      tx.select({ id: returnRecords.id }).from(returnRecords).where(and(eq(returnRecords.rentalId, id), eq(returnRecords.userId, access.userId))),
      tx.select({ id: lossRecords.id }).from(lossRecords).where(and(eq(lossRecords.rentalId, id), eq(lossRecords.userId, access.userId))),
      tx.select({ id: rentalEvents.id }).from(rentalEvents).where(and(eq(rentalEvents.rentalId, id), eq(rentalEvents.userId, access.userId))),
      tx.select({ id: accountLedger.id }).from(accountLedger).where(and(eq(accountLedger.rentalId, id), eq(accountLedger.userId, access.userId))),
    ])
    const relatedRecords = [
      ['收款', payments],
      ['买断', buyouts],
      ['续租', renewals],
      ['退租', returns],
      ['丢失', losses],
      ['售后或状态变更', events],
      ['资金流水', ledger],
    ] as const
    const existingTypes = relatedRecords.filter(([, records]) => records.length > 0).map(([label]) => label)
    if (existingTypes.length > 0) throw new Error(`该合同已有${existingTypes.join('、')}记录，不能永久删除；请使用“关闭订单”保留业务记录`)
    await tx.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '删除', resourceType: '租赁合同', resourceId: String(id), summary: `删除测试合同 ${rental.contractNo}`, metadata: { customerName: rental.customerName } })
    await tx.delete(receivableBills).where(and(eq(receivableBills.rentalId, id), eq(receivableBills.userId, access.userId)))
    await tx.delete(contractSnapshots).where(and(eq(contractSnapshots.rentalId, id), eq(contractSnapshots.userId, access.userId)))
    await tx.delete(rentalItems).where(and(eq(rentalItems.rentalId, id), eq(rentalItems.userId, access.userId)))
    await tx.delete(rentals).where(and(eq(rentals.id, id), eq(rentals.userId, access.userId)))
  }
  revalidatePath('/')
}
