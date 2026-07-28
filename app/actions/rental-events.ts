'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, receivableBills, rentalEvents, rentalItemPricePeriods, rentalItems, rentals } from '@/lib/db/schema'
import { assertDateOrder, dateOnly, fromCents, inclusiveDays, proratedMonthlyRentChange, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { availableQuantity } from '@/lib/rental-lifecycle'
import { compressDeviceCodes, expandDeviceCodes } from '@/lib/rental-numbers'
import { userErrorMessage } from '@/lib/errors'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, name: context.actorName }
}

const optionalText = z.string().trim().max(500).optional()
const deviceTypeSchema = z.enum(['台式机','笔记本','显示器','一体机','其他'])
const configurationSchema = {
  deviceConfig: optionalText, cpu: optionalText, motherboard: optionalText, memory: optionalText, storage: optionalText, graphicsCard: optionalText, powerSupply: optionalText, caseModel: optionalText, monitorInfo: optionalText,
  screenSize: optionalText, screenResolution: optionalText, refreshRate: optionalText, panelType: optionalText, ports: optionalText, batteryInfo: optionalText, adapterInfo: optionalText, accessories: optionalText, colorGamut: optionalText,
}
const changeSchema = z.object({
  rentalId: z.number().int().positive(), itemId: z.number().int().positive(), eventDate: z.string().min(1), reason: z.string().trim().min(2),
  selectedDeviceCodes: z.array(z.string().trim().min(1)).min(1), changeConfiguration: z.boolean(), changeRent: z.boolean(),
  deviceName: z.string().trim().min(2), deviceType: deviceTypeSchema, deviceCode: optionalText, quantity: z.coerce.number().int().positive(), ...configurationSchema,
  monthlyRent: z.coerce.number().positive('租金单价必须大于 0'), totalRent: z.coerce.number().nonnegative(), feeAdjustment: z.coerce.number(), notes: optionalText,
}).refine((value) => value.changeConfiguration || value.changeRent, { message: '请至少选择配置变更或租金变更' })
export type RentalChangeInput = z.infer<typeof changeSchema>

const repairSchema = z.object({ rentalId: z.number().int().positive(), itemId: z.number().int().positive(), eventDate: z.string().min(1), status: z.enum(['待维修','维修中','已完成']), faultDescription: z.string().trim().min(2), resolution: optionalText, repairCost: z.coerce.number().nonnegative(), customerCharge: z.coerce.number().nonnegative(), completedDate: z.string().optional(), notes: optionalText })
export type RepairInput = z.infer<typeof repairSchema>

const snapshotKeys = ['deviceName','deviceType','deviceCode','deviceConfig','quantity','monthlyRent','totalRent','cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut'] as const
function snapshot(item: Record<string, unknown>) { return Object.fromEntries(snapshotKeys.map(key => [key, item[key]])) }

async function performRentalItemChange(input: RentalChangeInput) {
  const context = await getAccessContext('租赁操作')
  const { userId, actorName: name, actorId } = context
  const value = changeSchema.parse(input)
  const [[item], [rental], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.itemId))),
    db.select().from(rentals).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备明细不存在')
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理变更')
  dateOnly(value.eventDate)
  if (item.startDate && value.eventDate < item.startDate) throw new Error('变更日期不能早于设备起租日期')
  if (item.endDate && value.eventDate > item.endDate) throw new Error('变更日期不能晚于设备到期日期')
  const available = availableQuantity(item)
  if (available <= 0) throw new Error('已全部处置的设备不能变更')
  const allCodes = expandDeviceCodes(item.deviceCode, item.quantity)
  if (allCodes.length !== item.quantity) throw new Error('该明细的设备编号无法逐台识别，请先补全连续编号')
  const selectedCodes = [...new Set(value.selectedDeviceCodes)]
  if (selectedCodes.some((code) => !allCodes.includes(code))) throw new Error('所选设备编号不属于当前明细')
  if (selectedCodes.length > available) throw new Error(`当前最多可变更 ${available} 台设备`)
  const unselectedCodes = allCodes.filter((code) => !selectedCodes.includes(code))
  const selectedCount = selectedCodes.length
  if (selectedCount !== value.selectedDeviceCodes.length) throw new Error('设备编号存在重复，请重新选择变更设备')
  const previousMonthlyRent = item.monthlyRent
  const nextMonthlyRent = value.changeRent ? fromCents(toCents(value.monthlyRent)) : item.monthlyRent
  if (value.changeRent && toCents(nextMonthlyRent) <= 0) throw new Error('新月租必须大于 0')
  const proration = proratedMonthlyRentChange({ effectiveDate: value.eventDate, oldMonthlyRent: previousMonthlyRent, newMonthlyRent: nextMonthlyRent, quantity: selectedCount })
  const feeAdjustmentCents = value.changeRent ? toCents(proration.differenceAmount) : 0
  const configurationPatch = value.changeConfiguration ? { deviceName:value.deviceName, deviceType:value.deviceType, deviceConfig:value.deviceConfig||null, cpu:value.cpu||null, motherboard:value.motherboard||null, memory:value.memory||null, storage:value.storage||null, graphicsCard:value.graphicsCard||null, powerSupply:value.powerSupply||null, caseModel:value.caseModel||null, monitorInfo:value.monitorInfo||null, screenSize:value.screenSize||null, screenResolution:value.screenResolution||null, refreshRate:value.refreshRate||null, panelType:value.panelType||null, ports:value.ports||null, batteryInfo:value.batteryInfo||null, adapterInfo:value.adapterInfo||null, accessories:value.accessories||null, colorGamut:value.colorGamut||null } : {}
  const selectedPatch = { ...configurationPatch, deviceCode:compressDeviceCodes(selectedCodes), quantity:selectedCount, monthlyRent:nextMonthlyRent, totalRent:item.totalRent, boughtOutQuantity:0, returnedQuantity:0, lostQuantity:0, updatedAt:new Date() }
  const wholeGroup = selectedCount === item.quantity
  const generatedId = () => Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const targetItemId = wholeGroup ? item.id : generatedId()
  // 事件编号必须独立生成。整组变更会复用原设备明细 ID，不能再用 item.id + 1，否则会与历史事件主键冲突。
  const eventId = generatedId()
  const futureMonthlyRentCents = items.reduce((sum,current) => {
    if (current.id !== item.id) return sum + toCents(current.monthlyRent) * availableQuantity(current)
    return sum + toCents(nextMonthlyRent) * selectedCount + toCents(item.monthlyRent) * unselectedCodes.length
  }, 0)
  const totalRentCents = toCents(rental.totalRent) + feeAdjustmentCents
  const paymentStatus = paymentStatusFromCents(totalRentCents, toCents(rental.paidAmount))
  const after = { ...snapshot(item), ...selectedPatch }
  const statements: Array<Parameters<typeof db.batch>[0][number]> = []
  if (wholeGroup) {
    statements.push(db.update(rentalItems).set(selectedPatch).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))))
  } else {
    statements.push(
      db.update(rentalItems).set({ deviceCode:compressDeviceCodes(unselectedCodes), quantity:unselectedCodes.length, updatedAt:new Date() }).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
      db.insert(rentalItems).values({ ...item, ...selectedPatch, id:targetItemId }),
    )
  }
  statements.push(
    db.update(rentals).set({ quantity:items.reduce((sum,current)=>sum+availableQuantity(current),0),monthlyRent:fromCents(futureMonthlyRentCents),totalRent:fromCents(totalRentCents),paymentStatus,updatedAt:new Date() }).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(rentalEvents).values({id:eventId,userId,rentalId:value.rentalId,itemId:targetItemId,eventType:value.changeConfiguration&&value.changeRent?'配置与租金变更':value.changeRent?'租金变更':'配置变更',eventDate:value.eventDate,beforeSnapshot:{...snapshot(item),selectedDeviceCodes:selectedCodes},afterSnapshot:after,reason:value.reason,feeAdjustment:fromCents(feeAdjustmentCents),operatorName:name,notes:value.notes}),
    db.insert(auditLogs).values({userId,actorUserId:actorId,actorName:name,action:'配置租金变更',resourceType:'租赁合同',resourceId:String(value.rentalId),summary:`${rental.contractNo} 变更 ${selectedCount} 台设备（${compressDeviceCodes(selectedCodes)}）`,metadata:{eventId,sourceItemId:item.id,targetItemId,selectedCodes,changeConfiguration:value.changeConfiguration,changeRent:value.changeRent,proration}}),
  )
  if (value.changeRent) {
    statements.push(db.insert(rentalItemPricePeriods).values({userId,rentalId:value.rentalId,rentalItemId:targetItemId,sourceRentalItemId:item.id,deviceCodes:compressDeviceCodes(selectedCodes),quantity:selectedCount,effectiveDate:value.eventDate,previousMonthlyRent:fromCents(toCents(previousMonthlyRent)),newMonthlyRent:nextMonthlyRent,proratedDifference:proration.differenceAmount,reason:value.reason,operatorUserId:actorId,operatorName:name}))
    if (feeAdjustmentCents !== 0) statements.push(
      db.insert(receivableBills).values({userId,rentalId:value.rentalId,billNo:`PRICE-${value.rentalId}-${eventId}`,periodStart:value.eventDate,periodEnd:value.eventDate,dueDate:value.eventDate,billType:feeAdjustmentCents>0?'租金变更补收':'租金变更减免',amount:fromCents(feeAdjustmentCents),paidAmount:'0.00',status:feeAdjustmentCents>0?'待收':'已减免',notes:`${compressDeviceCodes(selectedCodes)}：${value.reason}`}),
      db.insert(accountLedger).values({userId,rentalId:value.rentalId,entryType:'租金变更',amount:fromCents(feeAdjustmentCents),entryDate:value.eventDate,operatorName:name,notes:`生效月按 ${proration.daysInMonth} 天折算；${value.reason}`}),
    )
  }
  try {
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/rental_item_price_periods|no such table/i.test(message)) throw new Error('租金变更数据结构尚未就绪，请联系管理员完成数据库升级')
    if (/unique constraint|primary key/i.test(message)) throw new Error('本次变更记录编号冲突，请重新提交')
    throw error
  }
  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/rentals')
  revalidatePath('/finance')
  revalidatePath('/audit-logs')
}

export async function changeRentalItem(input: RentalChangeInput) {
  try {
    await performRentalItemChange(input)
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, message: userErrorMessage(error, '配置与租金变更失败，请核对设备和生效日期后重试') }
  }
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
