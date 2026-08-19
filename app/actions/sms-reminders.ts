'use server'

import { and, eq, inArray, lt } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { auditLogs, rentalItems, rentals } from '@/lib/db/schema'
import { businessSmsReadiness, sendBusinessSms, type BusinessSmsScene } from '@/lib/business-sms'
import { maskCustomerPhone } from '@/lib/customer-phone-auth'
import { beijingDate, hasRemainingRentalItems } from '@/lib/sms-reminder-rules'

const MAX_BATCH = 20
const ACTIVE_STATUSES = ['在租', '即将到期', '部分买断', '部分退租']
export type SmsReminderResult = { rentalId: number; contractNo: string; ok: boolean; skipped?: boolean; message: string }

async function logAudit(input: { userId: string; actorUserId: string; actorName: string; rentalId: number; contractNo: string; phone: string; scene: string; ok: boolean }) {
  await db.insert(auditLogs).values({ userId: input.userId, actorUserId: input.actorUserId, actorName: input.actorName, action: '发送业务短信', resourceType: '租赁合同', resourceId: String(input.rentalId), summary: `${input.ok ? '成功' : '失败'}发送${input.scene}至 ${maskCustomerPhone(input.phone)}`, metadata: { contractNo: input.contractNo, phone: maskCustomerPhone(input.phone), scene: input.scene, result: input.ok ? 'success' : 'failed' } })
}

export async function getBusinessSmsStatus() {
  await getAccessContext('租赁操作')
  return {
    rentalCreated: businessSmsReadiness('rental-created').configured,
    reminder: businessSmsReadiness('due-reminder').configured,
    overdue: businessSmsReadiness('overdue-reminder').configured,
    renewal: businessSmsReadiness('renewal-completed').configured,
    payment: businessSmsReadiness('payment-received').configured,
    repair: businessSmsReadiness('repair-completed').configured,
    rentalReturn: businessSmsReadiness('return-completed').configured,
    buyout: businessSmsReadiness('buyout-completed').configured,
  }
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

export async function sendLifecycleNotice(rentalId: number, scene: Exclude<BusinessSmsScene, 'rental-created' | 'due-reminder' | 'overdue-reminder'>, sourceId: string): Promise<SmsReminderResult> {
  const access = await getAccessContext('租赁操作')
  const [contract] = await db.select().from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.id, rentalId))).limit(1)
  if (!contract) throw new Error('合同不存在或无权操作')
  const result = await sendBusinessSms({
    userId: access.userId,
    rentalId: contract.id,
    phone: contract.customerPhone,
    scene,
    triggerType: 'operation-flow',
    actorUserId: access.actorId,
    idempotencyKey: `${access.userId}:${contract.id}:${scene}:${sourceId}`,
    params: { customer: contract.customerName.slice(0, 20), contractNo: contract.contractNo, dueDate: contract.endDate },
  })
  await logAudit({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, rentalId: contract.id, contractNo: contract.contractNo, phone: contract.customerPhone, scene: businessSmsReadiness(scene).sceneName, ok: result.ok })
  return { rentalId: contract.id, contractNo: contract.contractNo, ok: result.ok, message: result.message }
}

export async function sendRentalReminders(rentalIds: number[], reminderScene: 'due' | 'overdue' = 'due'): Promise<SmsReminderResult[]> {
  const access = await getAccessContext('租赁操作')
  const ids = [...new Set(rentalIds.filter(Number.isInteger))]
  if (!ids.length) throw new Error('请先选择需要提醒的合同')
  if (ids.length > MAX_BATCH) throw new Error(`每次最多发送 ${MAX_BATCH} 条短信`)
  const contracts = await db.select().from(rentals).where(and(eq(rentals.userId, access.userId), inArray(rentals.id, ids), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active')))
  const selectedItems = await db.select().from(rentalItems).where(inArray(rentalItems.rentalId, ids))
  const currentDate = beijingDate()
  const scene: BusinessSmsScene = reminderScene === 'overdue' ? 'overdue-reminder' : 'due-reminder'
  const sceneName = reminderScene === 'overdue' ? '逾期催收' : '到期提醒'
  const results: SmsReminderResult[] = []
  for (const contract of contracts) {
    const stillEligible = hasRemainingRentalItems(selectedItems.filter((item) => item.rentalId === contract.id)) && (reminderScene === 'overdue' ? contract.endDate < currentDate : contract.endDate >= currentDate)
    if (!stillEligible) {
      results.push({ rentalId: contract.id, contractNo: contract.contractNo, ok: false, skipped: true, message: '合同状态已变化，本次未发送' })
      continue
    }
    const result = await sendBusinessSms({ userId: access.userId, rentalId: contract.id, phone: contract.customerPhone, scene, triggerType: 'manual', actorUserId: access.actorId, idempotencyKey: `${access.userId}:${contract.id}:${scene}:${currentDate}`, params: { customer: contract.customerName.slice(0, 20), contractNo: contract.contractNo, dueDate: contract.endDate } })
    await logAudit({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, rentalId: contract.id, contractNo: contract.contractNo, phone: contract.customerPhone, scene: sceneName, ok: result.ok })
    results.push({ rentalId: contract.id, contractNo: contract.contractNo, ok: result.ok, skipped: result.duplicate || result.skipped, message: result.message })
  }
  return results
}

export async function processAutomaticOverdueReminders() {
  const currentDate = beijingDate()
  if (!businessSmsReadiness('overdue-reminder').configured) {
    return { currentDate, scanned: 0, eligible: 0, sent: 0, failed: 0, skipped: 0, configurationSkipped: true }
  }
  const contracts = await db.select().from(rentals).where(and(lt(rentals.endDate, currentDate), inArray(rentals.status, ACTIVE_STATUSES), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active')))
  const contractIds = contracts.map((contract) => contract.id)
  const items = contractIds.length
    ? await db.select({ rentalId: rentalItems.rentalId, quantity: rentalItems.quantity, boughtOutQuantity: rentalItems.boughtOutQuantity, returnedQuantity: rentalItems.returnedQuantity, lostQuantity: rentalItems.lostQuantity }).from(rentalItems).where(inArray(rentalItems.rentalId, contractIds))
    : []
  const itemsByRental = new Map<number, typeof items>()
  for (const item of items) itemsByRental.set(item.rentalId, [...(itemsByRental.get(item.rentalId) ?? []), item])
  const eligible = contracts.filter((contract) => {
    if (!hasRemainingRentalItems(itemsByRental.get(contract.id) ?? [])) return false
    const overdueDays = Math.floor((Date.parse(`${currentDate}T00:00:00Z`) - Date.parse(`${contract.endDate}T00:00:00Z`)) / 86400000)
    return overdueDays === 1 || overdueDays % 3 === 0
  })
  let sent = 0
  let failed = 0
  let skipped = contracts.length - eligible.length
  for (const contract of eligible) {
    const result = await sendBusinessSms({ userId: contract.userId, rentalId: contract.id, phone: contract.customerPhone, scene: 'overdue-reminder', triggerType: 'automatic', idempotencyKey: `${contract.userId}:${contract.id}:overdue-reminder:${currentDate}`, params: { customer: contract.customerName.slice(0, 20), contractNo: contract.contractNo, dueDate: contract.endDate } })
    if (result.ok) sent += 1
    else if (result.duplicate || result.skipped) skipped += 1
    else failed += 1
  }
  return { currentDate, scanned: contracts.length, eligible: eligible.length, sent, failed, skipped, configurationSkipped: false }
}

export async function processAutomaticDueReminders() {
  const dueDate = beijingDate(3)
  if (!businessSmsReadiness('due-reminder').configured) {
    return { dueDate, scanned: 0, eligible: 0, sent: 0, failed: 0, skipped: 0, configurationSkipped: true }
  }

  const contracts = await db.select().from(rentals).where(and(eq(rentals.endDate, dueDate), inArray(rentals.status, ACTIVE_STATUSES), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active')))
  const contractIds = contracts.map((contract) => contract.id)
  const items = contractIds.length
    ? await db.select({ rentalId: rentalItems.rentalId, quantity: rentalItems.quantity, boughtOutQuantity: rentalItems.boughtOutQuantity, returnedQuantity: rentalItems.returnedQuantity, lostQuantity: rentalItems.lostQuantity }).from(rentalItems).where(inArray(rentalItems.rentalId, contractIds))
    : []
  const itemsByRental = new Map<number, typeof items>()
  for (const item of items) {
    const current = itemsByRental.get(item.rentalId) ?? []
    current.push(item)
    itemsByRental.set(item.rentalId, current)
  }
  const eligibleContracts = contracts.filter((contract) => hasRemainingRentalItems(itemsByRental.get(contract.id) ?? []))

  let sent = 0
  let failed = 0
  let skipped = contracts.length - eligibleContracts.length
  for (const contract of eligibleContracts) {
    const result = await sendBusinessSms({ userId: contract.userId, rentalId: contract.id, phone: contract.customerPhone, scene: 'due-reminder', triggerType: 'automatic', idempotencyKey: `${contract.userId}:${contract.id}:due-reminder:${dueDate}`, params: { customer: contract.customerName.slice(0, 20), dueDate } })
    if (result.ok) sent += 1
    else if (result.duplicate || result.skipped) skipped += 1
    else failed += 1
  }
  return { dueDate, scanned: contracts.length, eligible: eligibleContracts.length, sent, failed, skipped, configurationSkipped: false }
}
