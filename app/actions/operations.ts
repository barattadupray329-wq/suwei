'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, lossRecords, paymentRecords, receivableBills, rentalEvents, rentalItems, rentals, returnRecords } from '@/lib/db/schema'
import { availableQuantity, rentalLifecycleStatus } from '@/lib/rental-lifecycle'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, actorId: context.actorId, name: context.actorName }
}

const operationSchema = z.object({ rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), quantity: z.number().int().positive(), date: z.string().min(1), notes: z.string().optional() })
const settlementSchema = z.object({ timing: z.enum(['now', 'later']), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })
export type ReturnInput = z.infer<typeof operationSchema> & { condition: '完好'|'轻微磨损'|'损坏'; deductionAmount: number; depositRefund: number; collectionSettlement: z.infer<typeof settlementSchema>; refundSettlement: z.infer<typeof settlementSchema> }
export type LossInput = z.infer<typeof operationSchema> & { unitCompensation: number }

export async function returnRentalItem(input: ReturnInput) {
  const { userId, actorId, name } = await actor()
  const value = operationSchema.extend({ condition: z.enum(['完好','轻微磨损','损坏']), deductionAmount: z.number().nonnegative(), depositRefund: z.number().nonnegative(), collectionSettlement: settlementSchema, refundSettlement: settlementSchema }).parse(input)
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  const available = availableQuantity(item)
  if (value.quantity>available) throw new Error(`最多可退 ${available} 台`)
  const nextReturned = item.returnedQuantity + value.quantity
  const nextItems = items.map(current => current.id === item.id ? { ...current, returnedQuantity: nextReturned } : current)
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, value.rentalId)))
  if (!rental) throw new Error('租赁合同不存在')
  const availableAfter = nextItems.reduce((sum, current) => sum + availableQuantity(current), 0)
  const returnId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const collectedAmount = value.collectionSettlement.timing === 'now' ? value.deductionAmount : 0
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(rentalItems).set({returnedQuantity:nextReturned,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.insert(returnRecords).values({id:returnId,userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,returnDate:value.date,condition:value.condition,deductionAmount:String(value.deductionAmount),depositRefund:String(value.depositRefund),notes:value.notes,operatorName:name}),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, itemId: value.rentalItemId, eventType: '退租', status: '已完成', eventDate: value.date, beforeSnapshot: { availableQuantity: available }, afterSnapshot: { availableQuantity: available - value.quantity, returnedQuantity: nextReturned, condition: value.condition, collectionSettlement: value.collectionSettlement.timing, refundSettlement: value.refundSettlement.timing }, feeAdjustment: String(value.deductionAmount - value.depositRefund), operatorName: name, notes: value.notes }),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '办理退租', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 退租 ${item.deviceName} ${value.quantity} 台`, metadata: { rentalItemId: value.rentalItemId, quantity: value.quantity, condition: value.condition, deductionAmount: value.deductionAmount, depositRefund: value.depositRefund } }),
  ]
  const itemEndDate = item.endDate
  if (itemEndDate && value.date < itemEndDate) {
    const unusedDays = Math.max(0, Math.ceil((new Date(`${itemEndDate}T00:00:00Z`).getTime() - new Date(`${value.date}T00:00:00Z`).getTime()) / 86400000))
    const reduction = Math.round((Number(item.monthlyRent) / 30) * unusedDays * value.quantity * 100) / 100
    if (reduction > 0) statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `RETURN-${value.rentalId}-${Date.now()}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '提前退租减免', amount: String(-reduction), paidAmount: '0', status: '已调整', notes: `提前 ${unusedDays} 天退租，按实际使用天数结算` }))
  }
  if (value.deductionAmount > 0) {
    statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `RETURN-CHARGE-${value.rentalId}-${returnId}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '退租赔偿', amount: String(value.deductionAmount), paidAmount: String(collectedAmount), status: collectedAmount > 0 ? '已结清' : '待收', notes: `${item.deviceName} 退租赔偿；${collectedAmount > 0 ? '本次已收款' : '约定以后收款'}` }))
    if (collectedAmount > 0) statements.push(db.insert(paymentRecords).values({ userId, rentalId: value.rentalId, returnRecordId: returnId, amount: String(collectedAmount), paymentDate: value.date, paymentMethod: value.collectionSettlement.method, feeType: '其他', operatorName: name, notes: '退租赔偿即时收款' }))
  }
  if (value.depositRefund > 0) statements.push(db.insert(accountLedger).values({ userId, rentalId: value.rentalId, entryType: value.refundSettlement.timing === 'now' ? '押金退还' : '押金待退', amount: String(-value.depositRefund), entryDate: value.date, operatorName: name, notes: `${value.notes || ''}${value.notes ? '；' : ''}${value.refundSettlement.timing === 'now' ? `已通过${value.refundSettlement.method}退还` : '约定以后退还'}` }))
  const paidAmount = Number(rental.paidAmount) + collectedAmount
  const totalRent = Number(rental.totalRent) + value.deductionAmount
  statements.push(db.update(rentals).set({ quantity: availableAfter, totalRent: String(totalRent), paidAmount: String(paidAmount), paymentStatus: paidAmount >= totalRent ? '已结清' : paidAmount > 0 ? '部分收款' : '待收款', status:rentalLifecycleStatus(nextItems), updatedAt:new Date() }).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
  revalidatePath('/audit-logs')
}

const exchangeText = z.string().trim().max(500).optional()
const exchangeSchema = z.object({
  rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), exchangeDate: z.string().min(1), newDeviceName: z.string().trim().min(2), newDeviceType: z.enum(['台式机','笔记本','显示器','一体机','其他']), newDeviceCode: z.string().trim().min(1), newDeviceConfig: exchangeText,
  cpu:exchangeText,motherboard:exchangeText,memory:exchangeText,storage:exchangeText,graphicsCard:exchangeText,powerSupply:exchangeText,caseModel:exchangeText,monitorInfo:exchangeText,screenSize:exchangeText,screenResolution:exchangeText,refreshRate:exchangeText,panelType:exchangeText,ports:exchangeText,batteryInfo:exchangeText,adapterInfo:exchangeText,accessories:exchangeText,colorGamut:exchangeText,
  reason: z.string().trim().min(2), notes: exchangeText,
})
export type ExchangeInput = z.infer<typeof exchangeSchema>

export async function exchangeRentalItem(input: ExchangeInput) {
  const { userId, name } = await actor()
  const value = exchangeSchema.parse(input)
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), eq(rentalItems.rentalId, value.rentalId), eq(rentalItems.id, value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  const keys = ['deviceName','deviceType','deviceCode','deviceConfig','cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut'] as const
  const before = Object.fromEntries(keys.map(key => [key, item[key]]))
  const after = { deviceName:value.newDeviceName,deviceType:value.newDeviceType,deviceCode:value.newDeviceCode,deviceConfig:value.newDeviceConfig||null,cpu:value.cpu||null,motherboard:value.motherboard||null,memory:value.memory||null,storage:value.storage||null,graphicsCard:value.graphicsCard||null,powerSupply:value.powerSupply||null,caseModel:value.caseModel||null,monitorInfo:value.monitorInfo||null,screenSize:value.screenSize||null,screenResolution:value.screenResolution||null,refreshRate:value.refreshRate||null,panelType:value.panelType||null,ports:value.ports||null,batteryInfo:value.batteryInfo||null,adapterInfo:value.adapterInfo||null,accessories:value.accessories||null,colorGamut:value.colorGamut||null }
  const nextItems = items.map(current => current.id === item.id ? { ...current, ...after } : current)
  await db.batch([
    db.update(rentalItems).set({ ...after, updatedAt: new Date() }).where(and(eq(rentalItems.userId, userId), eq(rentalItems.id, item.id))),
    db.update(rentals).set({deviceName:nextItems.map(current=>current.deviceName).join('、'),deviceType:nextItems.length===1?nextItems[0].deviceType:'多设备',updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, eventType: '换机调拨', status: '已完成', eventDate: value.exchangeDate, itemId: item.id, beforeSnapshot: before, afterSnapshot: after, reason: value.reason, operatorName: name, notes: value.notes }),
  ])
  revalidatePath('/')
}

export async function reportLostItem(input: LossInput) {
  const { userId, name } = await actor()
  const value = operationSchema.extend({ unitCompensation: z.number().positive() }).parse(input)
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  const available = availableQuantity(item)
  if (value.quantity>available) throw new Error(`最多可登记丢失 ${available} 台`)
  const nextLost = item.lostQuantity + value.quantity
  const nextItems = items.map(current => current.id === item.id ? { ...current, lostQuantity: nextLost } : current)
  await db.batch([
    db.update(rentalItems).set({lostQuantity:nextLost,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.insert(lossRecords).values({userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,lossDate:value.date,unitCompensation:String(value.unitCompensation),amount:String(value.unitCompensation*value.quantity),notes:value.notes,operatorName:name}),
    db.update(rentals).set({status:rentalLifecycleStatus(nextItems),updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
  ])
  revalidatePath('/')
}
