'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, lossRecords, paymentRecords, receivableBills, rentalEvents, rentalItems, rentalOperations, rentals, returnRecords } from '@/lib/db/schema'
import { availableQuantity, rentalLifecycleStatus } from '@/lib/rental-lifecycle'
import { operationIdempotencyKey, operationNumber, safeOperationId } from '@/lib/rental-operation-hub'
import { dateOnly, fromCents, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { buildNextDeviceCode, compressDeviceCodes, expandDeviceCodes } from '@/lib/rental-numbers'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, actorId: context.actorId, name: context.actorName }
}

function revalidateRentalBusiness() {
  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/rentals')
  revalidatePath('/finance')
  revalidatePath('/audit-logs')
}

const operationSchema = z.object({ rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), clientRequestId: z.string().uuid(), deviceCodes: z.array(z.string().trim().min(1)).min(1).optional(), quantity: z.number().int().positive(), date: z.string().min(1), notes: z.string().optional() })
const settlementSchema = z.object({ timing: z.enum(['now', 'later']), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })
export type ReturnInput = z.infer<typeof operationSchema> & { condition: '完好'|'轻微磨损'|'损坏'; deductionAmount: number; depositRefund: number; collectionSettlement: z.infer<typeof settlementSchema>; refundSettlement: z.infer<typeof settlementSchema> }
export type LossInput = z.infer<typeof operationSchema> & { unitCompensation: number }

export async function returnRentalItem(input: ReturnInput) {
  const { userId, actorId, name } = await actor()
  const value = operationSchema.extend({ condition: z.enum(['完好','轻微磨损','损坏']), deductionAmount: z.number().nonnegative(), depositRefund: z.number().nonnegative(), collectionSettlement: settlementSchema, refundSettlement: settlementSchema }).parse(input)
  const idempotencyKey = operationIdempotencyKey({ userId, rentalId: value.rentalId, type: 'return', clientRequestId: value.clientRequestId })
  const [completed] = await db.select({ id: rentalOperations.id }).from(rentalOperations).where(and(eq(rentalOperations.userId, userId), eq(rentalOperations.idempotencyKey, idempotencyKey))).limit(1)
  if (completed) return { ok: true as const, repeated: true as const }
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  dateOnly(value.date)
  if (item.startDate && value.date < item.startDate) throw new Error('退租日期不能早于设备起租日期')
  const available = availableQuantity(item)
  const allCodes = expandDeviceCodes(item.deviceCode, item.quantity)
  if (allCodes.length !== item.quantity) throw new Error('该设备编号无法逐台识别，请先补全编号')
  const disposedCount = item.boughtOutQuantity + item.returnedQuantity + item.lostQuantity
  const activeCodes = allCodes.slice(disposedCount)
  const selectedCodes = [...new Set(value.deviceCodes ?? activeCodes.slice(0, value.quantity))]
  if (selectedCodes.length !== value.quantity) throw new Error('退租数量与所选编号不一致')
  if (selectedCodes.some((code) => !activeCodes.includes(code))) throw new Error('包含不可退租或不属于当前明细的编号')
  if (value.quantity>available) throw new Error(`最多可退 ${available} 台`)
  const unselectedCodes = allCodes.filter((code) => !selectedCodes.includes(code))
  const wholeActiveGroup = value.quantity === item.quantity && disposedCount === 0
  const targetItemId = wholeActiveGroup ? item.id : Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const nextReturned = wholeActiveGroup ? item.returnedQuantity + value.quantity : value.quantity
  const nextItems = items.flatMap(current => current.id !== item.id ? [current] : wholeActiveGroup
    ? [{ ...current, returnedQuantity: nextReturned }]
    : [{ ...current, deviceCode: compressDeviceCodes(unselectedCodes), quantity: unselectedCodes.length }, { ...current, id: targetItemId, deviceCode: compressDeviceCodes(selectedCodes), quantity: value.quantity, boughtOutQuantity: 0, lostQuantity: 0, returnedQuantity: value.quantity }])
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, value.rentalId)))
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理退租')
  const availableAfter = nextItems.reduce((sum, current) => sum + availableQuantity(current), 0)
  const returnId = safeOperationId()
  const operationNo = `${operationNumber('return', value.rentalId)}-${returnId}`
  const collectedAmount = value.collectionSettlement.timing === 'now' ? value.deductionAmount : 0
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.insert(rentalOperations).values({ userId, rentalId: value.rentalId, operationNo, operationType: 'return', status: 'completed', idempotencyKey, actorUserId: actorId, actorName: name, summary: `${rental.contractNo} 退租 ${item.deviceName} ${value.quantity} 台`, beforeSnapshot: { itemId: item.id, availableQuantity: available, contractQuantity: rental.quantity, totalRent: rental.totalRent, paidAmount: rental.paidAmount }, afterSnapshot: { itemId: item.id, availableQuantity: available - value.quantity, contractQuantity: availableAfter }, resultJson: { returnRecordId: returnId }, completedAt: new Date() }),
    ...(wholeActiveGroup
      ? [db.update(rentalItems).set({returnedQuantity:nextReturned,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id)))]
      : [
          db.update(rentalItems).set({deviceCode:compressDeviceCodes(unselectedCodes),quantity:unselectedCodes.length,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
          db.insert(rentalItems).values({...item,id:targetItemId,deviceCode:compressDeviceCodes(selectedCodes),quantity:value.quantity,boughtOutQuantity:0,lostQuantity:0,returnedQuantity:value.quantity,totalRent:String(Number(item.monthlyRent)*value.quantity),updatedAt:new Date()}),
        ]),
    db.insert(returnRecords).values({id:returnId,userId,rentalId:value.rentalId,rentalItemId:targetItemId,quantity:value.quantity,returnDate:value.date,condition:value.condition,deductionAmount:String(value.deductionAmount),depositRefund:String(value.depositRefund),notes:`${compressDeviceCodes(selectedCodes)}${value.notes ? `；${value.notes}` : ''}`,operatorName:name}),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, itemId: targetItemId, eventType: '退租', status: '已完成', eventDate: value.date, beforeSnapshot: { selectedDeviceCodes: selectedCodes, availableQuantity: available }, afterSnapshot: { selectedDeviceCodes: selectedCodes, availableQuantity: available - value.quantity, returnedQuantity: nextReturned, condition: value.condition, collectionSettlement: value.collectionSettlement.timing, refundSettlement: value.refundSettlement.timing }, feeAdjustment: String(value.deductionAmount - value.depositRefund), operatorName: name, notes: value.notes }),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '办理退租', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 退租 ${item.deviceName} ${value.quantity} 台`, metadata: { rentalItemId: value.rentalItemId, quantity: value.quantity, condition: value.condition, deductionAmount: value.deductionAmount, depositRefund: value.depositRefund } }),
  ]
  const itemEndDate = item.endDate
  let reductionCents = 0
  if (itemEndDate && value.date < itemEndDate) {
    const unusedDays = Math.max(0, Math.ceil((dateOnly(itemEndDate).getTime() - dateOnly(value.date).getTime()) / 86400000))
    reductionCents = Math.round(toCents(item.monthlyRent) * unusedDays * value.quantity / 30)
    if (reductionCents > 0) statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `RETURN-${value.rentalId}-${returnId}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '提前退租减免', amount: fromCents(-reductionCents), paidAmount: '0.00', status: '已调整', notes: `提前 ${unusedDays} 天退租，按实际使用天数结算` }))
  }
  if (value.deductionAmount > 0) {
    statements.push(db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `RETURN-CHARGE-${value.rentalId}-${returnId}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '退租赔偿', amount: String(value.deductionAmount), paidAmount: String(collectedAmount), status: collectedAmount > 0 ? '已结清' : '待收', notes: `${item.deviceName} 退租赔偿；${collectedAmount > 0 ? '本次已收款' : '约定以后收款'}` }))
    if (collectedAmount > 0) statements.push(db.insert(paymentRecords).values({ userId, rentalId: value.rentalId, returnRecordId: returnId, amount: String(collectedAmount), paymentDate: value.date, paymentMethod: value.collectionSettlement.method, feeType: '其他', operatorName: name, notes: '退租赔偿即时收款' }))
  }
  if (value.depositRefund > 0) statements.push(db.insert(accountLedger).values({ userId, rentalId: value.rentalId, entryType: value.refundSettlement.timing === 'now' ? '押金退还' : '押金待退', amount: String(-value.depositRefund), entryDate: value.date, operatorName: name, notes: `${value.notes || ''}${value.notes ? '；' : ''}${value.refundSettlement.timing === 'now' ? `已通过${value.refundSettlement.method}退还` : '约定以后退还'}` }))
  const paidCents = toCents(rental.paidAmount) + toCents(collectedAmount)
  const totalRentCents = toCents(rental.totalRent) + toCents(value.deductionAmount) - reductionCents
  if (totalRentCents < 0) throw new Error('退租调整后合同总额不能小于 0')
  statements.push(db.update(rentals).set({ quantity: availableAfter, totalRent: fromCents(totalRentCents), paidAmount: fromCents(paidCents), paymentStatus: paymentStatusFromCents(totalRentCents, paidCents), status:rentalLifecycleStatus(nextItems), updatedAt:new Date() }).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))))
  try {
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/rental_operations.*idempotency|unique constraint.*idempotency/i.test(message)) return { ok: true as const, repeated: true as const }
    throw error
  }
  revalidateRentalBusiness()
  return { ok: true as const, repeated: false as const }
}

const exchangeText = z.string().trim().max(500).optional()
const exchangeSchema = z.object({
  rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), exchangeDate: z.string().min(1), newDeviceName: z.string().trim().min(2), newDeviceType: z.enum(['台式机','笔记本','显示器','一体机','其他']), newDeviceConfig: exchangeText,
  cpu:exchangeText,motherboard:exchangeText,memory:exchangeText,storage:exchangeText,graphicsCard:exchangeText,powerSupply:exchangeText,caseModel:exchangeText,monitorInfo:exchangeText,screenSize:exchangeText,screenResolution:exchangeText,refreshRate:exchangeText,panelType:exchangeText,ports:exchangeText,batteryInfo:exchangeText,adapterInfo:exchangeText,accessories:exchangeText,colorGamut:exchangeText,
  reason: z.string().trim().min(2), notes: exchangeText,
})
export type ExchangeInput = z.infer<typeof exchangeSchema>

export async function exchangeRentalItem(input: ExchangeInput) {
  const { userId, actorId, name } = await actor()
  const value = exchangeSchema.parse(input)
  dateOnly(value.exchangeDate)
  const [[item], [rental], items, allDeviceCodes] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), eq(rentalItems.rentalId, value.rentalId), eq(rentalItems.id, value.rentalItemId))),
    db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, value.rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
    db.select({ deviceCode: rentalItems.deviceCode }).from(rentalItems).where(eq(rentalItems.userId, userId)),
  ])
  if (!item) throw new Error('设备不存在')
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理换机')
  if (availableQuantity(item) <= 0) throw new Error('已全部处置的设备不能办理换机')
  if (item.startDate && value.exchangeDate < item.startDate) throw new Error('换机日期不能早于设备起租日期')
  if (item.endDate && value.exchangeDate > item.endDate) throw new Error('换机日期不能晚于设备到期日期')
  const newDeviceCode = buildNextDeviceCode(value.exchangeDate, value.newDeviceType, allDeviceCodes.map((row) => row.deviceCode))
  if (allDeviceCodes.some((row) => expandDeviceCodes(row.deviceCode).includes(newDeviceCode))) throw new Error('新设备编号发生冲突，请重新提交')
  const keys = ['deviceName','deviceType','deviceCode','deviceConfig','cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut'] as const
  const before = Object.fromEntries(keys.map(key => [key, item[key]]))
  const after = { deviceName:value.newDeviceName,deviceType:value.newDeviceType,deviceCode:newDeviceCode,deviceConfig:value.newDeviceConfig||null,cpu:value.cpu||null,motherboard:value.motherboard||null,memory:value.memory||null,storage:value.storage||null,graphicsCard:value.graphicsCard||null,powerSupply:value.powerSupply||null,caseModel:value.caseModel||null,monitorInfo:value.monitorInfo||null,screenSize:value.screenSize||null,screenResolution:value.screenResolution||null,refreshRate:value.refreshRate||null,panelType:value.panelType||null,ports:value.ports||null,batteryInfo:value.batteryInfo||null,adapterInfo:value.adapterInfo||null,accessories:value.accessories||null,colorGamut:value.colorGamut||null }
  const nextItems = items.map(current => current.id === item.id ? { ...current, ...after } : current)
  await db.batch([
    db.update(rentalItems).set({ ...after, updatedAt: new Date() }).where(and(eq(rentalItems.userId, userId), eq(rentalItems.id, item.id))),
    db.update(rentals).set({deviceName:nextItems.map(current=>current.deviceName).join('、'),deviceType:nextItems.length===1?nextItems[0].deviceType:'多设备',updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(rentalEvents).values({ id: safeOperationId(), userId, rentalId: value.rentalId, eventType: '换机调拨', status: '已完成', eventDate: value.exchangeDate, itemId: item.id, beforeSnapshot: before, afterSnapshot: after, reason: value.reason, operatorName: name, notes: value.notes }),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '设备换机', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo}：${item.deviceCode || item.deviceName} 更换为 ${newDeviceCode}`, metadata: { rentalItemId: item.id, before, after, reason: value.reason } }),
  ])
  revalidateRentalBusiness()
}

export async function reportLostItem(input: LossInput) {
  const { userId, actorId, name } = await actor()
  const value = operationSchema.extend({ unitCompensation: z.number().positive() }).parse(input)
  const idempotencyKey = operationIdempotencyKey({ userId, rentalId: value.rentalId, type: 'loss', clientRequestId: value.clientRequestId })
  const [completed] = await db.select({ id: rentalOperations.id }).from(rentalOperations).where(and(eq(rentalOperations.userId, userId), eq(rentalOperations.idempotencyKey, idempotencyKey))).limit(1)
  if (completed) return { ok: true as const, repeated: true as const }
  dateOnly(value.date)
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  if (item.startDate && value.date < item.startDate) throw new Error('丢失日期不能早于设备起租日期')
  const available = availableQuantity(item)
  if (value.quantity>available) throw new Error(`最多可登记丢失 ${available} 台`)
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, value.rentalId)))
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以登记丢失')
  const nextLost = item.lostQuantity + value.quantity
  const nextItems = items.map(current => current.id === item.id ? { ...current, lostQuantity: nextLost } : current)
  const amount = Math.round(value.unitCompensation * value.quantity * 100) / 100
  const lossId = safeOperationId()
  const operationNo = `${operationNumber('loss', value.rentalId)}-${lossId}`
  const nextQuantity = nextItems.reduce((sum, current) => sum + availableQuantity(current), 0)
  const nextTotalCents = Math.round(Number(rental.totalRent) * 100) + Math.round(amount * 100)
  try {
    await db.batch([
    db.insert(rentalOperations).values({ userId, rentalId: value.rentalId, operationNo, operationType: 'loss', status: 'completed', idempotencyKey, actorUserId: actorId, actorName: name, summary: `${rental.contractNo} 登记丢失 ${item.deviceName} ${value.quantity} 台`, beforeSnapshot: { itemId: item.id, availableQuantity: available, contractQuantity: rental.quantity, totalRent: rental.totalRent }, afterSnapshot: { itemId: item.id, availableQuantity: available - value.quantity, contractQuantity: nextQuantity, totalRent: nextTotalCents / 100 }, resultJson: { lossRecordId: lossId }, completedAt: new Date() }),
    db.update(rentalItems).set({lostQuantity:nextLost,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.insert(lossRecords).values({id:lossId,userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,lossDate:value.date,unitCompensation:String(value.unitCompensation),amount:String(amount),notes:value.notes,operatorName:name}),
    db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `LOSS-${value.rentalId}-${lossId}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '丢失赔偿', amount: String(amount), paidAmount: '0', status: '待收', notes: `${item.deviceName} ${value.quantity} 台丢失赔偿` }),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, itemId: item.id, eventType: '设备丢失', status: '已完成', eventDate: value.date, beforeSnapshot: { availableQuantity: available }, afterSnapshot: { availableQuantity: available - value.quantity, lostQuantity: nextLost }, feeAdjustment: String(amount), operatorName: name, notes: value.notes }),
    db.update(rentals).set({quantity:nextQuantity,totalRent:String(nextTotalCents / 100),status:rentalLifecycleStatus(nextItems),paymentStatus:Number(rental.paidAmount) >= nextTotalCents / 100 ? '已结清' : Number(rental.paidAmount) > 0 ? '部分收款' : '待收款',updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '登记丢失', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 丢失 ${item.deviceName} ${value.quantity} 台，新增应收 ${amount.toFixed(2)} 元`, metadata: { operationNo, rentalItemId: item.id, quantity: value.quantity, amount } }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/rental_operations.*idempotency|unique constraint.*idempotency/i.test(message)) return { ok: true as const, repeated: true as const }
    throw error
  }
  revalidateRentalBusiness()
  return { ok: true as const, repeated: false as const }
}
