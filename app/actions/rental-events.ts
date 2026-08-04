'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, receivableBills, rentalEvents, rentalItems, rentals } from '@/lib/db/schema'
import { addCalendarMonths, assertDateOrder, dateOnly, fromCents, inclusiveDays, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { priceChangeAdjustment } from '@/lib/overdue-rent'
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
function pricePeriod(startDate: string, effectiveDate: string) { let periodStart=startDate,periodEnd=addCalendarMonths(startDate,1);while(periodEnd<=effectiveDate){periodStart=periodEnd;periodEnd=addCalendarMonths(periodStart,1)}return{periodStart,periodEnd} }

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
  const available = availableQuantity(item)
  const { periodStart, periodEnd } = pricePeriod(item.startDate ?? rental.startDate, value.eventDate)
  const { newPriceDays: remainingDays, adjustmentCents } = priceChangeAdjustment({periodStart,periodEnd,effectiveDate:value.eventDate,oldMonthlyRent:item.monthlyRent,newMonthlyRent:String(value.monthlyRent),quantity:available})
  const calculatedFeeAdjustment = Number(fromCents(adjustmentCents))
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
  if (toCents(calculatedFeeAdjustment) !== 0) statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `CHANGE-${value.rentalId}-${eventId}`, periodStart: value.eventDate, periodEnd, dueDate: value.eventDate, billType: calculatedFeeAdjustment > 0 ? '配置变更补收' : '配置变更减免', amount: fromCents(toCents(calculatedFeeAdjustment)), paidAmount: '0.00', status: calculatedFeeAdjustment > 0 ? '待收' : '已减免', notes: `${value.reason}；生效日起至当前账期结束共 ${remainingDays} 天按 30 天折算，后续账期使用新租金` }))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
}

export async function changeRentalItems(input: RentalChangeInput[]) {
  const { userId, actorId, name } = await actor()
  const values = z.array(changeSchema).min(1).max(100).parse(input)
  const rentalId = values[0].rentalId
  if (values.some((value) => value.rentalId !== rentalId)) throw new Error('批量配置变更必须属于同一合同')
  if (new Set(values.map((value) => value.itemId)).size !== values.length) throw new Error('同一设备不能重复提交')
  const [[rental], items] = await Promise.all([
    db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), eq(rentalItems.rentalId, rentalId))),
  ])
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理配置变更')
  const byId = new Map(items.map((item) => [item.id, item]))
  const now = new Date()
  const changes = values.map((value, index) => {
    const item = byId.get(value.itemId)
    if (!item || availableQuantity(item) <= 0) throw new Error('包含不存在或已处置的设备')
    dateOnly(value.eventDate)
    const oldEndDate = item.endDate ?? rental.endDate
    if ((item.startDate && value.eventDate < item.startDate) || value.eventDate > oldEndDate) throw new Error(`${item.deviceName} 的变更日期不在租期内`)
    if (value.quantity !== item.quantity) throw new Error('配置变更不能调整数量')
    const adjustedEndDate = value.giftDays > 0 ? addDays(oldEndDate, value.giftDays) : oldEndDate
    const {periodStart,periodEnd}=pricePeriod(item.startDate??rental.startDate,value.eventDate)
    const {newPriceDays:remainingDays,adjustmentCents:feeCents}=priceChangeAdjustment({periodStart,periodEnd,effectiveDate:value.eventDate,oldMonthlyRent:item.monthlyRent,newMonthlyRent:String(value.monthlyRent),quantity:availableQuantity(item)})
    if (toCents(value.feeAdjustment) !== feeCents) throw new Error(`${item.deviceName} 的配置补差已变化，请刷新后重试`)
    const lineTotalCents = toCents(value.monthlyRent) * item.quantity
    const after = { ...snapshot(item), deviceName:value.deviceName, deviceType:value.deviceType, deviceCode:value.deviceCode||null, deviceConfig:value.deviceConfig||null, cpu:value.cpu||null, motherboard:value.motherboard||null, memory:value.memory||null, storage:value.storage||null, graphicsCard:value.graphicsCard||null, powerSupply:value.powerSupply||null, caseModel:value.caseModel||null, monitorInfo:value.monitorInfo||null, screenSize:value.screenSize||null, screenResolution:value.screenResolution||null, refreshRate:value.refreshRate||null, panelType:value.panelType||null, ports:value.ports||null, batteryInfo:value.batteryInfo||null, adapterInfo:value.adapterInfo||null, accessories:value.accessories||null, colorGamut:value.colorGamut||null, monthlyRent:fromCents(toCents(value.monthlyRent)), totalRent:fromCents(lineTotalCents), endDate:adjustedEndDate, giftDays:value.giftDays }
    return { value, item, oldEndDate, adjustedEndDate, periodEnd, remainingDays, feeCents, lineTotalCents, after, eventId: Date.now() * 1000 + index }
  })
  const finalItems = items.map((item) => {
    const change = changes.find((entry) => entry.item.id === item.id)
    return change ? { ...item, ...change.after } : item
  })
  const quantity = finalItems.reduce((sum, item) => sum + availableQuantity(item), 0)
  const monthlyRentCents = finalItems.reduce((sum, item) => sum + toCents(item.monthlyRent) * availableQuantity(item), 0)
  const totalRentCents = toCents(rental.totalRent) + changes.reduce((sum, change) => sum - toCents(change.item.totalRent) + change.lineTotalCents + change.feeCents, 0)
  if (totalRentCents < 0) throw new Error('调整后合同金额不能小于 0')
  const statements: Array<Parameters<typeof db.batch>[0][number]> = []
  for (const change of changes) {
    statements.push(
      db.update(rentalItems).set({ ...change.after, updatedAt: now }).where(and(eq(rentalItems.userId, userId), eq(rentalItems.id, change.item.id))),
      db.insert(rentalEvents).values({ id:change.eventId,userId,rentalId,itemId:change.item.id,eventType:'配置变更',eventDate:change.value.eventDate,beforeSnapshot:{...snapshot(change.item),endDate:change.oldEndDate},afterSnapshot:change.after,reason:change.value.reason,feeAdjustment:fromCents(change.feeCents),operatorName:name,notes:[change.value.notes,change.value.giftDays ? `赠送 ${change.value.giftDays} 天，到期日顺延至 ${change.adjustedEndDate}` : ''].filter(Boolean).join('；') }),
      db.insert(auditLogs).values({ userId,actorUserId:actorId,actorName:name,action:'配置变更',resourceType:'租赁合同',resourceId:String(rentalId),summary:`${rental.contractNo} 批量配置变更：${change.item.deviceName}`,metadata:{itemId:change.item.id,feeAdjustment:fromCents(change.feeCents)} }),
    )
    if (change.feeCents !== 0) statements.push(db.insert(receivableBills).values({ userId,rentalId,billNo:`CHANGE-${rentalId}-${change.eventId}`,periodStart:change.value.eventDate,periodEnd:change.periodEnd,dueDate:change.value.eventDate,billType:change.feeCents > 0 ? '配置变更补收' : '配置变更减免',amount:fromCents(change.feeCents),paidAmount:'0.00',status:change.feeCents > 0 ? '待收' : '已减免',notes:`${change.value.reason}；生效日起至当前账期结束共 ${change.remainingDays} 天按 30 天折算，后续账期使用新租金` }))
  }
  statements.push(db.update(rentals).set({ deviceName:finalItems.map((item)=>item.deviceName).join('、'),deviceType:finalItems.length===1?finalItems[0].deviceType:'多设备',quantity,monthlyRent:fromCents(monthlyRentCents),totalRent:fromCents(totalRentCents),endDate:finalItems.map((item)=>item.endDate ?? rental.endDate).sort().at(-1) ?? rental.endDate,paymentStatus:paymentStatusFromCents(totalRentCents,toCents(rental.paidAmount)),updatedAt:now }).where(and(eq(rentals.userId,userId),eq(rentals.id,rentalId))))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
}

export async function createRepairRecords(input: RepairInput[]) {
  const context = await getAccessContext('租赁操作')
  const values = z.array(repairSchema).min(1).max(100).parse(input)
  const rentalId = values[0].rentalId
  if (values.some((value) => value.rentalId !== rentalId)) throw new Error('批量维修必须属于同一合同')
  if (new Set(values.map((value) => value.itemId)).size !== values.length) throw new Error('同一设备不能重复提交')
  const [[rental], items] = await Promise.all([
    db.select().from(rentals).where(and(eq(rentals.userId,context.userId),eq(rentals.id,rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,context.userId),eq(rentalItems.rentalId,rentalId))),
  ])
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以登记维修')
  const byId = new Map(items.map((item) => [item.id, item]))
  const rows = values.map((value, index) => {
    const item = byId.get(value.itemId)
    if (!item || availableQuantity(item) <= 0) throw new Error('包含不存在或已处置的设备')
    dateOnly(value.eventDate)
    if (item.startDate && value.eventDate < item.startDate) throw new Error(`${item.deviceName} 的维修日期不能早于起租日期`)
    if (value.completedDate) assertDateOrder(value.eventDate,value.completedDate,'维修完成日期不能早于维修登记日期')
    if (value.status === '已完成' && !value.completedDate) throw new Error('维修完成时必须填写完成日期')
    return { value, item, eventId: Date.now() * 1000 + index }
  })
  const chargeCents = rows.reduce((sum, row) => sum + toCents(row.value.customerCharge), 0)
  const totalRentCents = toCents(rental.totalRent) + chargeCents
  const statements: Array<Parameters<typeof db.batch>[0][number]> = []
  for (const row of rows) {
    statements.push(
      db.insert(rentalEvents).values({ id:row.eventId,userId:context.userId,rentalId,itemId:row.item.id,eventType:'维修',status:row.value.status,eventDate:row.value.eventDate,beforeSnapshot:snapshot(row.item),faultDescription:row.value.faultDescription,resolution:row.value.resolution,repairCost:fromCents(toCents(row.value.repairCost)),customerCharge:fromCents(toCents(row.value.customerCharge)),completedDate:row.value.completedDate||null,operatorName:context.actorName,notes:row.value.notes }),
      db.insert(auditLogs).values({ userId:context.userId,actorUserId:context.actorId,actorName:context.actorName,action:'登记维修',resourceType:'租赁合同',resourceId:String(rentalId),summary:`${rental.contractNo} 登记 ${row.item.deviceName} 维修，客户承担 ${row.value.customerCharge.toFixed(2)} 元`,metadata:{eventId:row.eventId,itemId:row.item.id,status:row.value.status} }),
    )
    if (toCents(row.value.customerCharge) > 0) statements.push(db.insert(receivableBills).values({ userId:context.userId,rentalId,billNo:`REPAIR-${rentalId}-${row.eventId}`,periodStart:row.value.eventDate,periodEnd:row.value.completedDate||row.value.eventDate,dueDate:row.value.completedDate||row.value.eventDate,billType:'维修费',amount:fromCents(toCents(row.value.customerCharge)),paidAmount:'0.00',status:'待收',notes:`${row.item.deviceName} 维修客户承担费用` }))
  }
  statements.push(db.update(rentals).set({ totalRent:fromCents(totalRentCents),paymentStatus:paymentStatusFromCents(totalRentCents,toCents(rental.paidAmount)),updatedAt:new Date() }).where(and(eq(rentals.userId,context.userId),eq(rentals.id,rentalId))))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
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
