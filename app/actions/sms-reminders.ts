'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { auditLogs, rentals } from '@/lib/db/schema'
import { businessSmsReadiness, sendBusinessSms } from '@/lib/business-sms'
import { maskCustomerPhone } from '@/lib/customer-phone-auth'

const MAX_BATCH = 20
const ACTIVE_STATUSES = ['在租', '即将到期', '部分买断', '部分退租']
export type SmsReminderResult = { rentalId: number; contractNo: string; ok: boolean; message: string }

function beijingDate(offsetDays = 0) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  now.setUTCDate(now.getUTCDate() + offsetDays)
  return now.toISOString().slice(0, 10)
}

async function logAudit(input: { userId: string; actorUserId: string; actorName: string; rentalId: number; contractNo: string; phone: string; scene: string; ok: boolean }) {
  await db.insert(auditLogs).values({ userId: input.userId, actorUserId: input.actorUserId, actorName: input.actorName, action: '发送业务短信', resourceType: '租赁合同', resourceId: String(input.rentalId), summary: `${input.ok ? '成功' : '失败'}发送${input.scene}至 ${maskCustomerPhone(input.phone)}`, metadata: { contractNo: input.contractNo, phone: maskCustomerPhone(input.phone), scene: input.scene, result: input.ok ? 'success' : 'failed' } })
}

export async function getBusinessSmsStatus() {
  await getAccessContext('租赁操作')
  return { rentalCreated: businessSmsReadiness('rental-created').configured, reminder: businessSmsReadiness('due-reminder').configured }
}

export async function sendRentalCreatedNotice(rentalId: number): Promise<SmsReminderResult> {
  const access = await getAccessContext('租赁操作')
  const [contract] = await db.select().from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.id, rentalId))).limit(1)
  if (!contract) throw new Error('合同不存在或无权操作')
  if (contract.orderType !== 'official' || contract.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以发送短信')
  const result = await sendBusinessSms({ userId: access.userId, rentalId: contract.id, phone: contract.customerPhone, scene: 'rental-created', triggerType: 'manual', actorUserId: access.actorId, idempotencyKey: `${access.userId}:${contract.id}:rental-created:v1`, params: { customer: contract.customerName.slice(0, 20), dueDate: contract.endDate } })
  await logAudit({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, rentalId: contract.id, contractNo: contract.contractNo, phone: contract.customerPhone, scene: '初始租赁通知', ok: result.ok })
  return { rentalId: contract.id, contractNo: contract.contractNo, ok: result.ok, message: result.message }
}

export async function sendRentalReminders(rentalIds: number[]): Promise<SmsReminderResult[]> {
  const access = await getAccessContext('租赁操作')
  const ids = [...new Set(rentalIds.filter(Number.isInteger))]
  if (!ids.length) throw new Error('请先选择需要提醒的合同')
  if (ids.length > MAX_BATCH) throw new Error(`每次最多发送 ${MAX_BATCH} 条短信`)
  const contracts = await db.select().from(rentals).where(and(eq(rentals.userId, access.userId), inArray(rentals.id, ids), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active')))
  const results: SmsReminderResult[] = []
  for (const contract of contracts) {
    const result = await sendBusinessSms({ userId: access.userId, rentalId: contract.id, phone: contract.customerPhone, scene: 'due-reminder', triggerType: 'manual', actorUserId: access.actorId, idempotencyKey: `${access.userId}:${contract.id}:due-reminder:${beijingDate()}`, params: { customer: contract.customerName.slice(0, 20), dueDate: contract.endDate } })
    await logAudit({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, rentalId: contract.id, contractNo: contract.contractNo, phone: contract.customerPhone, scene: '到期提醒', ok: result.ok })
    results.push({ rentalId: contract.id, contractNo: contract.contractNo, ok: result.ok, message: result.message })
  }
  return results
}

export async function processAutomaticDueReminders() {
  const dueDate = beijingDate(3)
  if (!businessSmsReadiness('due-reminder').configured) return { dueDate, scanned: 0, sent: 0, failed: 0, skipped: true }
  const contracts = await db.select().from(rentals).where(and(eq(rentals.endDate, dueDate), inArray(rentals.status, ACTIVE_STATUSES), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active')))
  let sent = 0
  let failed = 0
  for (const contract of contracts) {
    const result = await sendBusinessSms({ userId: contract.userId, rentalId: contract.id, phone: contract.customerPhone, scene: 'due-reminder', triggerType: 'automatic', idempotencyKey: `${contract.userId}:${contract.id}:due-reminder:${dueDate}`, params: { customer: contract.customerName.slice(0, 20), dueDate } })
    if (result.ok) sent += 1
    else failed += 1
  }
  return { dueDate, scanned: contracts.length, sent, failed, skipped: false }
}
