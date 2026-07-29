'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, receivableBills, rentalEvents, rentalItems, rentals } from '@/lib/db/schema'
import { assertDateOrder, dateOnly, fromCents, inclusiveDays, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { availableQuantity } from '@/lib/rental-lifecycle'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, actorId: context.actorId, name: context.actorName }
}

const optionalText = z.string().trim().max(500).optional()
const deviceTypeSchema = z.enum(['台式机','笔记本','显示器','一体机','其他'])
const configurationSchema = {
  deviceConfig: optionalText, cpu: optionalText, motherboard: optionalText, memory: optionalText, storage: optionalText, graphicsCard: optionalText, powerSupply: optionalText, caseModel: optionalText, monitorInfo: optionalText,
  screenSize: optionalText, screenResolution: optionalText, refreshRate: optionalText, panelType: optionalText, ports: optionalText, batteryInfo: optionalText, adapterInfo: optionalText, accessories: optionalText, colorGamut: optionalText,
}
const changeSchema = z.object({
  rentalId: z.number().int().positive(), itemId: z.number().int().positive(), eventDate: z.string().min(1), reason: z.string().trim().min(2),
  deviceName: z.string().trim().min(2), deviceType: deviceTypeSchema, deviceCode: optionalText, quantity: z.coerce.number().int().positive(), ...configurationSchema,
  monthlyRent: z.coerce.number().positive('租金单价必须大于 0'), totalRent: z.coerce.number().positive(), feeAdjustment: z.coerce.number(), giftDays: z.coerce.number().int().min(0).max(365), notes: optionalText,
})
export type RentalChangeInput = z.infer<typeof changeSchema>

const repairSchema = z.object({ rentalId: z.number().int().positive(), itemId: z.number().int().positive(), eventDate: z.string().min(1), status: z.enum(['待维修','维修中','已完成']), faultDescription: z.string().trim().min(2), resolution: optionalText, repairCost: z.coerce.number().nonnegative(), customerCharge: z.coerce.number().nonnegative(), completedDate: z.string().optional(), notes: optionalText })
export type RepairInput = z.infer<typeof repairSchema>

const snapshotKeys = ['deviceName','deviceType','deviceCode','deviceConfig','quantity','monthlyRent','totalRent','cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut'] as const
function snapshot(item: Record<string, unknown>) { return Object.fromEntries(snapshotKeys.map(key => [key, item[key]])) }
function addDays(date: string, days: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }

export async function changeRentalItem(input: RentalChangeInput) {
  const { userId, actorId, name } = await actor()
  const value = changeSchema.parse(input)
  const [item] = await db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.itemId)))
  if (!item) throw new Error('设备明细不存在')
  dateOnly(value.eventDate)
  if (item.startDate && value.eventDate < item.startDate) throw new Error('变更日期不能早于设备起租日期')
  if (value.quantity !== item.quantity) throw new Error('配置变更不能调整数量，请使用独立的增配或设备处置流程')
  if (availableQuantity(item) <= 0) throw new Error('已全部处置的设备不能变更配置')
  const [[rental], items] = await Promise.all([
    db.select().from(rentals).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!rental) throw new Error('租赁合同不存在')
  const oldEndDate = item.endDate ?? rental.endDate
  if (value.eventDate > oldEndDate) throw new Error('配置变更日期不能晚于当前到期日')
  const adjustedEndDate = value.giftDays > 0 ? addDays(oldEndDate, value.giftDays) : oldEndDate
  const remainingDays = inclusiveDays(value.eventDate, oldEndDate)
  const available = availableQuantity(item)
  const calculatedFeeAdjustment = Number(fromCents(Math.round((toCents(value.monthlyRent) - toCents(item.monthlyRent)) * available * remainingDays / 30)))
  if (toCents(value.feeAdjustment) !== toCents(calculatedFeeAdjustment)) throw new Error(`配置补差应为 ${calculatedFeeAdjustment.toFixed(2)} 元，请刷新后重试`)
  const lineTotal = Number(fromCents(toCents(value.monthlyRent) * item.quantity))
  const after = { ...snapshot(item), deviceName:value.deviceName, deviceType:value.deviceType, deviceCode:value.deviceCode||null, quantity:value.quantity, deviceConfig:value.deviceConfig||null, cpu:value.cpu||null, motherboard:value.motherboard||null, memory:value.memory||null, storage:value.storage||null, graphicsCard:value.graphicsCard||null, powerSupply:value.powerSupply||null, caseModel:value.caseModel||null, monitorInfo:value.monitorInfo||null, screenSize:value.screenSize||null, screenResolution:value.screenResolution||null, refreshRate:value.refreshRate||null, panelType:value.panelType||null, ports:value.ports||null, batteryInfo:value.batteryInfo||null, adapterInfo:value.adapterInfo||null, accessories:value.accessories||null, colorGamut:value.colorGamut||null, monthlyRent:String(value.monthlyRent), totalRent:String(lineTotal), endDate:adjustedEndDate, giftDays:value.giftDays }
  const nextItems = items.map(current => current.id === item.id ? { ...current, ...after } : current)
  const quantity = nextItems.reduce((sum,current)=>sum+availableQuantity(current),0)
  const monthlyRentCents = nextItems.reduce((sum,current)=>sum+toCents(current.monthlyRent)*availableQuantity(current),0)
  const totalRentCents = toCents(rental.totalRent)-toCents(item.totalRent)+toCents(lineTotal)+toCents(calculatedFeeAdjustment)
  if (totalRentCents < 0) throw new Error('调整后合同金额不能小于 0')
  const paymentStatus = paymentStatusFromCents(totalRentCents, toCents(rental.paidAmount))
  const eventId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(rentalItems).set({ ...after, endDate: adjustedEndDate, monthlyRent: fromCents(toCents(value.monthlyRent)), totalRent: fromCents(toCents(lineTotal)), updatedAt:new Date() }).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.update(rentals).set({ deviceName:nextItems.map(current=>current.deviceName).join('、'),deviceType:nextItems.length===1?nextItems[0].deviceType:'多设备',quantity,monthlyRent:fromCents(monthlyRentCents),totalRent:fromCents(totalRentCents),endDate:nextItems.map(current=>current.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate,paymentStatus,updatedAt:new Date() }).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(rentalEvents).values({id:eventId,userId,rentalId:value.rentalId,itemId:value.itemId,eventType:'配置变更',eventDate:value.eventDate,beforeSnapshot:{...snapshot(item),endDate:oldEndDate},afterSnapshot:after,reason:value.reason,feeAdjustment:fromCents(toCents(calculatedFeeAdjustment)),operatorName:name,notes:[value.notes,value.giftDays ? `赠送 ${value.giftDays} 天，到期日顺延至 ${adjustedEndDate}` : ''].filter(Boolean).join('；')}),
    db.insert(auditLogs).values({userId,actorUserId:actorId,actorName:name,action:'配置变更',resourceType:'租赁合同',resourceId:String(value.rentalId),summary:`${rental.contractNo} 配置变更，月租 ${Number(item.monthlyRent).toFixed(2)} 元调整为 ${value.monthlyRent.toFixed(2)} 元${value.giftDays ? `，赠送 ${value.giftDays} 天` : ''}`,metadata:{itemId:item.id,eventDate:value.eventDate,oldMonthlyRent:Number(item.monthlyRent),newMonthlyRent:value.monthlyRent,remainingDays,feeAdjustment:calculatedFeeAdjustment,giftDays:value.giftDays,oldEndDate,adjustedEndDate}}),
  ]
  if (toCents(calculatedFeeAdjustment) !== 0) statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `CHANGE-${value.rentalId}-${eventId}`, periodStart: value.eventDate, periodEnd: oldEndDate, dueDate: value.eventDate, billType: calculatedFeeAdjustment > 0 ? '配置变更补收' : '配置变更减免', amount: fromCents(toCents(calculatedFeeAdjustment)), paidAmount: '0.00', status: calculatedFeeAdjustment > 0 ? '待收' : '已减免', notes: `${value.reason}；剩余 ${remainingDays} 天按 30 天折算` }))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
}

export async function createRepairRecord(input: RepairInput) {
  const context = await getAccessContext('租赁操作')
  const userId = context.userId
  const name = context.actorName
  const value = repairSchema.parse(input)
  const [[item], [rental]] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.itemId))),
    db.select().from(rentals).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
  ])
  if (!item) throw new Error('设备明细不存在')
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以登记维修')
  dateOnly(value.eventDate)
  if (item.startDate && value.eventDate < item.startDate) throw new Error('维修日期不能早于设备起租日期')
  if (value.completedDate) assertDateOrder(value.eventDate, value.completedDate, '维修完成日期不能早于维修登记日期')
  if (value.status === '已完成' && !value.completedDate) throw new Error('维修完成时必须填写完成日期')
  if (availableQuantity(item) <= 0) throw new Error('已全部处置的设备不能登记维修')
  const totalRentCents = toCents(rental.totalRent) + toCents(value.customerCharge)
  const paymentStatus = paymentStatusFromCents(totalRentCents, toCents(rental.paidAmount))
  const eventId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(rentals).set({totalRent:fromCents(totalRentCents),paymentStatus,updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(rentalEvents).values({id:eventId,userId,rentalId:value.rentalId,itemId:value.itemId,eventType:'维修',status:value.status,eventDate:value.eventDate,beforeSnapshot:snapshot(item),faultDescription:value.faultDescription,resolution:value.resolution,repairCost:fromCents(toCents(value.repairCost)),customerCharge:fromCents(toCents(value.customerCharge)),completedDate:value.completedDate||null,operatorName:name,notes:value.notes}),
    db.insert(auditLogs).values({ userId, actorUserId: context.actorId, actorName: name, action: '登记维修', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 登记 ${item.deviceName} 维修，客户承担 ${value.customerCharge.toFixed(2)} 元`, metadata: { eventId, itemId: value.itemId, status: value.status, repairCost: value.repairCost, customerCharge: value.customerCharge } }),
  ]
  if (toCents(value.customerCharge) > 0) statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `REPAIR-${value.rentalId}-${eventId}`, periodStart: value.eventDate, periodEnd: value.completedDate || value.eventDate, dueDate: value.completedDate || value.eventDate, billType: '维修费', amount: fromCents(toCents(value.customerCharge)), paidAmount: '0.00', status: '待收', notes: `${item.deviceName} 维修客户承担费用` }))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
}

const contractChangeSchema = z.object({
  rentalId: z.number().int().positive(),
  changeType: z.enum(['客户资料变更', '租期调整']),
  effectiveDate: z.string().min(1),
  reason: z.string().trim().min(2, '请填写变更原因'),
  customerName: z.string().trim().min(2).optional(),
  customerPhone: z.string().trim().min(6).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  feeAdjustment: z.coerce.number(),
  feeNote: z.string().trim().min(2, '请说明费用差额的处理依据'),
  customerConfirmed: z.boolean(),
})
export type ContractChangeInput = z.infer<typeof contractChangeSchema>

export async function changeRentalContract(input: ContractChangeInput) {
  const context = await getAccessContext('租赁操作')
  const value = contractChangeSchema.parse(input)
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.userId, context.userId), eq(rentals.id, value.rentalId)))
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理变更')
  dateOnly(value.effectiveDate)
  if (value.effectiveDate < rental.startDate) throw new Error('变更生效日期不能早于合同起租日期')
  if (value.changeType === '客户资料变更' && (!value.customerName || !value.customerPhone)) throw new Error('请填写新的联系人姓名和电话')
  if (value.changeType === '租期调整') {
    if (!value.startDate || !value.endDate) throw new Error('请选择新的起租日期和到期日期')
    assertDateOrder(value.startDate, value.endDate, '请选择有效的新起租日期和到期日期')
  }

  const beforeSnapshot = value.changeType === '客户资料变更'
    ? { customerName: rental.customerName, customerPhone: rental.customerPhone }
    : { startDate: rental.startDate, endDate: rental.endDate }
  const afterSnapshot = value.changeType === '客户资料变更'
    ? { customerName: value.customerName, customerPhone: value.customerPhone }
    : { startDate: value.startDate, endDate: value.endDate }
  const nextTotalCents = toCents(rental.totalRent) + toCents(value.feeAdjustment)
  if (nextTotalCents < 0) throw new Error('调整后合同金额不能小于 0')
  const paymentStatus = paymentStatusFromCents(nextTotalCents, toCents(rental.paidAmount))
  const eventId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const eventNote = `${value.feeNote}；客户${value.customerConfirmed ? '已确认' : '未确认'}`
  const rentalPatch = value.changeType === '客户资料变更'
    ? { customerName: value.customerName!, customerPhone: value.customerPhone!, totalRent: fromCents(nextTotalCents), paymentStatus, updatedAt: new Date() }
    : { startDate: value.startDate!, endDate: value.endDate!, duration: inclusiveDays(value.startDate!, value.endDate!), durationUnit: 'daily' as const, totalRent: fromCents(nextTotalCents), paymentStatus, updatedAt: new Date() }
  const statements = [
    db.update(rentals).set(rentalPatch).where(and(eq(rentals.userId, context.userId), eq(rentals.id, value.rentalId))),
    ...(value.changeType === '租期调整' ? [db.update(rentalItems).set({ startDate: value.startDate!, endDate: value.endDate!, updatedAt: new Date() }).where(and(eq(rentalItems.userId, context.userId), eq(rentalItems.rentalId, value.rentalId)))] : []),
    db.insert(rentalEvents).values({ id: eventId, userId: context.userId, rentalId: value.rentalId, eventType: value.changeType, eventDate: value.effectiveDate, beforeSnapshot, afterSnapshot, reason: value.reason, feeAdjustment: fromCents(toCents(value.feeAdjustment)), operatorName: context.actorName, notes: eventNote }),
    ...(toCents(value.feeAdjustment) !== 0 ? [
      db.insert(receivableBills).values({ userId: context.userId, rentalId: value.rentalId, billNo: `CONTRACT-CHANGE-${value.rentalId}-${eventId}`, periodStart: value.effectiveDate, periodEnd: value.effectiveDate, dueDate: value.effectiveDate, billType: value.feeAdjustment > 0 ? '合同变更补收' : '合同变更减免', amount: fromCents(toCents(value.feeAdjustment)), paidAmount: '0.00', status: value.feeAdjustment > 0 ? '待收' : '已减免', notes: `${value.changeType}：${value.reason}` }),
      db.insert(accountLedger).values({ userId: context.userId, rentalId: value.rentalId, entryType: '变更调整', amount: fromCents(toCents(value.feeAdjustment)), entryDate: value.effectiveDate, operatorName: context.actorName, notes: `${value.changeType}：${value.reason}；${value.feeNote}` }),
    ] : []),
    db.insert(auditLogs).values({ userId: context.userId, actorUserId: context.actorId, actorName: context.actorName, action: '租赁变更', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 办理${value.changeType}`, metadata: { eventId, beforeSnapshot, afterSnapshot, feeAdjustment: value.feeAdjustment, customerConfirmed: value.customerConfirmed } }),
  ]
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/dashboard')
  revalidatePath('/finance')
}

export async function getRentalEvents(rentalId:number) {
  const { userId } = await actor()
  return db.select().from(rentalEvents).where(and(eq(rentalEvents.userId,userId),eq(rentalEvents.rentalId,rentalId))).orderBy(desc(rentalEvents.eventDate),desc(rentalEvents.createdAt))
}
