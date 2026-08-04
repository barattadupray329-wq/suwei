'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, auditLogs, customerCreditLedger, lossRecords, paymentAllocations, paymentRecords, receivableBills, rentalEvents, rentalItems, rentalOperations, rentals, returnRecords, returnSettlements } from '@/lib/db/schema'
import { availableQuantity, rentalLifecycleStatus } from '@/lib/rental-lifecycle'
import { operationIdempotencyKey, operationNumber } from '@/lib/rental-operation-hub'
import { dateOnly, fromCents, toCents } from '@/lib/rental-calculations'
import { paymentStatusFromCents } from '@/lib/rental-reconciliation'
import { recalculateBillsAfterReturn, returnBillingAdjustment, returnTiming } from '@/lib/overdue-rent'
import { billingPeriodAt } from '@/lib/billing-periods'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, actorId: context.actorId, name: context.actorName }
}

const operationSchema = z.object({ rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), quantity: z.number().int().positive(), date: z.string().min(1), notes: z.string().optional() })
const settlementSchema = z.object({ timing: z.enum(['now', 'later']), method: z.enum(['现金', '微信', '支付宝', '银行卡', '其他']) })
const returnBillingModeSchema = z.enum(['full_month', 'daily', 'waive', 'late_daily', 'late_monthly', 'late_waive'])
export type ReturnInput = z.infer<typeof operationSchema> & { condition: '完好'|'轻微磨损'|'损坏'; deductionAmount: number; depositRefund: number; billingMode: z.infer<typeof returnBillingModeSchema>; billingReason: string; collectionSettlement: z.infer<typeof settlementSchema>; refundSettlement: z.infer<typeof settlementSchema>; rentRefundSettlement: z.infer<typeof settlementSchema> }
export type LossInput = z.infer<typeof operationSchema> & { unitCompensation: number }

const returnSchema = operationSchema.extend({ condition:z.enum(['完好','轻微磨损','损坏']),deductionAmount:z.number().nonnegative(),depositRefund:z.number().nonnegative(),billingMode:returnBillingModeSchema,billingReason:z.string().trim().max(500),collectionSettlement:settlementSchema,refundSettlement:settlementSchema,rentRefundSettlement:settlementSchema })
const lossSchema = operationSchema.extend({ unitCompensation:z.number().positive() })

export async function returnRentalItems(input: ReturnInput[]) {
  const { userId, actorId, name } = await actor()
  const values = z.array(returnSchema).min(1).max(100).parse(input)
  const rentalId = values[0].rentalId
  if (values.some((value)=>value.rentalId!==rentalId)) throw new Error('批量退租必须属于同一合同')
  if (new Set(values.map((value)=>value.rentalItemId)).size!==values.length) throw new Error('同一设备不能重复提交')
  const latestReturnDate = values.reduce((latest, value) => value.date > latest ? value.date : latest, values[0].date)
  const [[rental],items,bills]=await Promise.all([db.select().from(rentals).where(and(eq(rentals.userId,userId),eq(rentals.id,rentalId))),db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,rentalId))),db.select().from(receivableBills).where(and(eq(receivableBills.userId,userId),eq(receivableBills.rentalId,rentalId)))])
  if (!rental||rental.orderType!=='official'||rental.lifecycleStatus!=='active') throw new Error('仅正式有效合同可以办理退租')
  const byId=new Map(items.map((item)=>[item.id,item]))
  const rows=values.map((value,index)=>{const item=byId.get(value.rentalItemId);if(!item)throw new Error('包含不存在的设备');dateOnly(value.date);if(item.startDate&&value.date<item.startDate)throw new Error(`${item.deviceName} 的退租日期不能早于起租日期`);const available=availableQuantity(item);if(value.quantity>available)throw new Error(`${item.deviceName} 最多可退 ${available} 台`);const endDate=item.endDate??rental.endDate;const timing=returnTiming(value.date,endDate);const earlyModes=['full_month','daily','waive'],lateModes=['late_daily','late_monthly','late_waive'];if(timing==='early'&&!earlyModes.includes(value.billingMode))throw new Error(`${item.deviceName} 必须选择提前退租租金规则`);if(timing==='late'&&!lateModes.includes(value.billingMode))throw new Error(`${item.deviceName} 必须选择延迟退租补租规则`);if(timing!=='on_time'&&value.billingMode!=='full_month'&&!value.billingReason.trim())throw new Error(`${item.deviceName} 的租金处理必须填写协商说明`);const currentPeriod=timing==='late'?undefined:billingPeriodAt(item.startDate??rental.startDate,value.date);const periodStart=timing==='late'?endDate:currentPeriod!.start;const effectiveFrom=timing==='late'?value.date:currentPeriod!.endExclusive;const billing=timing==='on_time'?{fullAmountCents:0,chargedAmountCents:0,adjustmentCents:0,usedDays:30,lateDays:0}:returnBillingAdjustment({periodStart,returnDate:value.date,monthlyRent:item.monthlyRent,quantity:value.quantity,mode:value.billingMode});return{value,item,available,timing,effectiveFrom,currentPeriod:currentPeriod?{periodStart:currentPeriod.start,periodEnd:currentPeriod.endExclusive}:undefined,billing,id:Date.now()*1000+index}})
  const finalItems=items.map((item)=>{const row=rows.find((entry)=>entry.item.id===item.id);return row?{...item,returnedQuantity:item.returnedQuantity+row.value.quantity}:item})
  const billRecalculations=rows.flatMap((row)=>recalculateBillsAfterReturn({bills,monthlyRent:row.item.monthlyRent,returnedQuantity:row.value.quantity,effectiveFrom:row.effectiveFrom}))
  const futureBillReductionCents=billRecalculations.reduce((sum,bill)=>sum+bill.reductionCents,0)
  const deductionCents=rows.reduce((sum,row)=>sum+toCents(row.value.deductionAmount),0),billingAdjustmentCents=rows.reduce((sum,row)=>sum+row.billing.adjustmentCents,0),lateChargeCents=rows.reduce((sum,row)=>sum+(row.timing==='late'?row.billing.chargedAmountCents:0),0),collectedCents=rows.reduce((sum,row)=>sum+(row.value.collectionSettlement.timing==='now'?toCents(row.value.deductionAmount):0),0)
  const adjustedRentCents=toCents(rental.totalRent)-billingAdjustmentCents-futureBillReductionCents+lateChargeCents
  const rentRefundCents=Math.min(billingAdjustmentCents,Math.max(0,toCents(rental.paidAmount)-adjustedRentCents))
  const rentRefundNow=rentRefundCents>0&&values[0].rentRefundSettlement.timing==='now'
  const totalCents=adjustedRentCents+deductionCents,paidCents=toCents(rental.paidAmount)+collectedCents-(rentRefundNow?rentRefundCents:0)
  if(totalCents<0)throw new Error('退租调整后合同总额不能小于 0')
  const statements:Array<Parameters<typeof db.batch>[0][number]>=[]
  for(const row of rows){const v=row.value,next=row.item.returnedQuantity+v.quantity,collected=v.collectionSettlement.timing==='now'?v.deductionAmount:0,operationNo=`${operationNumber('return',rentalId)}-${row.id}`;statements.push(db.insert(rentalOperations).values({userId,rentalId,operationNo,operationType:'return',status:'completed',idempotencyKey:operationIdempotencyKey({userId,rentalId,type:'return',clientRequestId:crypto.randomUUID()}),actorUserId:actorId,actorName:name,summary:`${rental.contractNo} 退租 ${row.item.deviceName} ${v.quantity} 台`,completedAt:new Date()}),db.update(rentalItems).set({returnedQuantity:next,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,row.item.id))),db.insert(returnRecords).values({id:row.id,userId,rentalId,rentalItemId:row.item.id,quantity:v.quantity,returnDate:v.date,condition:v.condition,deductionAmount:fromCents(toCents(v.deductionAmount)),depositRefund:fromCents(toCents(v.depositRefund)),notes:v.notes,operatorName:name}),db.insert(rentalEvents).values({userId,rentalId,itemId:row.item.id,eventType:'退租',status:'已完成',eventDate:v.date,beforeSnapshot:{availableQuantity:row.available},afterSnapshot:{availableQuantity:row.available-v.quantity,returnedQuantity:next},feeAdjustment:fromCents(toCents(v.deductionAmount)-toCents(v.depositRefund)),operatorName:name,notes:v.notes}),db.insert(auditLogs).values({userId,actorUserId:actorId,actorName:name,action:'办理退租',resourceType:'租赁合同',resourceId:String(rentalId),summary:`${rental.contractNo} 退租 ${row.item.deviceName} ${v.quantity} 台`,metadata:{rentalItemId:row.item.id,quantity:v.quantity}}));false && statements.push(db.insert(returnSettlements).values({id:row.id,userId,rentalId,returnRecordId:row.id,customerPhone:rental.customerPhone,calculatedRefund:fromCents(row.billing.fullAmountCents),minimumTermMet:true,finalRefund:fromCents(row.billing.adjustmentCents),handlingType:v.billingMode==='full_month'?'整月收取':v.billingMode==='daily'?'按天收取':'本期不收',refundStatus:false?(v.refundSettlement.timing==='now'?'已退款':'待退款'):'无需退款',refundMethod:false?v.refundSettlement.method:null,refundDate:false&&v.refundSettlement.timing==='now'?v.date:null,reason:v.billingReason||null,operatorName:name}));if(false&&row.billing.adjustmentCents>0)statements.push(db.insert(customerCreditLedger).values({userId,customerPhone:rental.customerPhone,sourceRentalId:rentalId,returnSettlementId:row.id,entryType:'退租转入',amount:fromCents(row.billing.adjustmentCents),entryDate:v.date,operatorName:name,notes:v.billingReason||`${rental.contractNo} 退租转客户余额`}));if(false&&row.billing.adjustmentCents>0)statements.push(db.insert(accountLedger).values({userId,rentalId,entryType:v.refundSettlement.timing==='now'?'租金退款':'租金待退',amount:fromCents(-row.billing.adjustmentCents),entryDate:v.date,operatorName:name,notes:`${v.refundSettlement.timing==='now'?`已通过${v.refundSettlement.method}退款`:'约定以后退款'}${v.billingReason?`；${v.billingReason}`:''}`}));if(row.billing.adjustmentCents>0)statements.push(db.insert(receivableBills).values({userId,rentalId,billNo:`RETURN-${rentalId}-${row.id}`,periodStart:v.date,periodEnd:v.date,dueDate:v.date,billType:'提前退租减免',amount:fromCents(-row.billing.adjustmentCents),paidAmount:'0.00',status:'已调整',notes:'提前退租按实际使用天数结'}));if(v.deductionAmount>0)statements.push(db.insert(receivableBills).values({id:row.id,userId,rentalId,billNo:`RETURN-CHARGE-${rentalId}-${row.id}`,periodStart:v.date,periodEnd:v.date,dueDate:v.date,billType:'退租赔偿',amount:fromCents(toCents(v.deductionAmount)),paidAmount:fromCents(toCents(collected)),status:collected>0?'已结清':'待收',notes:`${row.item.deviceName} 退租赔偿`}));if(collected>0){const paymentId=row.id;statements.push(db.insert(paymentRecords).values({id:paymentId,userId,rentalId,returnRecordId:row.id,amount:fromCents(toCents(collected)),paymentDate:v.date,paymentMethod:v.collectionSettlement.method,feeType:'其他',operatorName:name,notes:'退租赔偿即时收款'}),db.insert(paymentAllocations).values({userId,rentalId,paymentRecordId:paymentId,billId:row.id,amount:fromCents(toCents(collected))}))};if(v.depositRefund>0)statements.push(db.insert(accountLedger).values({userId,rentalId,entryType:v.refundSettlement.timing==='now'?'押金退还':'押金待退',amount:fromCents(-toCents(v.depositRefund)),entryDate:v.date,operatorName:name,notes:v.notes}))}
  for (const bill of billRecalculations) {
    const sourceBill = bills.find((row) => row.id === bill.id)
    if (!sourceBill) continue
    const nextPaidCents = Math.min(toCents(sourceBill.paidAmount), bill.nextAmountCents)
    statements.push(db.update(receivableBills).set({
      amount: fromCents(bill.nextAmountCents),
      paidAmount: fromCents(nextPaidCents),
      status: nextPaidCents >= bill.nextAmountCents ? '已结清' : nextPaidCents > 0 ? '部分收款' : '待收',
      notes: `${sourceBill.notes ? `${sourceBill.notes}；` : ''}退租后按剩余设备数量重算，减少应收 ${fromCents(bill.reductionCents)} 元`,
      updatedAt: new Date(),
    }).where(and(eq(receivableBills.userId,userId),eq(receivableBills.id,bill.id))))
  }
  for (const row of rows) {
    if (row.timing === 'late' && row.billing.chargedAmountCents > 0) {
      const lateDays = row.billing.lateDays ?? 0
      const modeLabel = row.value.billingMode === 'late_daily' ? `按实际延迟 ${lateDays} 天补收` : `按 ${Math.ceil(lateDays / 30)} 个整月补收`
      statements.push(db.insert(receivableBills).values({userId,rentalId,billNo:`RETURN-LATE-${rentalId}-${row.id}`,periodStart:row.item.endDate??rental.endDate,periodEnd:row.value.date,dueDate:row.value.date,billType:'延迟退租补租',amount:fromCents(row.billing.chargedAmountCents),paidAmount:'0.00',status:'待收',notes:`${row.item.deviceName} ${row.value.quantity} 台；${modeLabel}；协商说明：${row.value.billingReason}`}))
      continue
    }
    if (!row.currentPeriod || row.billing.adjustmentCents <= 0) continue
    const modeLabel = row.value.billingMode === 'daily' ? `退剩余天数：固定按 30 天折算，已用 ${row.billing.usedDays} 天` : '退本期全额（不超过本期实收）'
    statements.push(db.insert(receivableBills).values({
      userId, rentalId, billNo: `RETURN-BILLING-${rentalId}-${row.id}`,
      periodStart: row.currentPeriod.periodStart, periodEnd: row.currentPeriod.periodEnd, dueDate: row.value.date,
      billType: '退租当期租金调整', amount: fromCents(-row.billing.adjustmentCents), paidAmount: '0.00', status: '已调整',
      notes: `${row.item.deviceName} ${row.value.quantity} 台；${modeLabel}；协商说明：${row.value.billingReason}`,
    }))
  }
  if(rentRefundCents>0){const settlement=values[0].rentRefundSettlement;statements.push(db.insert(accountLedger).values({userId,rentalId,entryType:settlement.timing==='now'?'租金退款':'租金待退',amount:fromCents(-rentRefundCents),entryDate:latestReturnDate,operatorName:name,notes:`退租租金退款；${settlement.timing==='now'?`已通过${settlement.method}退还`:'约定以后退还'}`}))}
  statements.push(db.update(rentals).set({quantity:finalItems.reduce((sum,item)=>sum+availableQuantity(item),0),totalRent:fromCents(totalCents),paidAmount:fromCents(paidCents),paymentStatus:paymentStatusFromCents(totalCents,paidCents),status:rentalLifecycleStatus(finalItems),updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,rentalId))))
  await db.batch(statements as [typeof statements[number],...Array<typeof statements[number]>]);revalidatePath('/');revalidatePath('/audit-logs')
}

export async function reportLostItems(input: LossInput[]) {
  const {userId,actorId,name}=await actor();const values=z.array(lossSchema).min(1).max(100).parse(input),rentalId=values[0].rentalId
  if(values.some((v)=>v.rentalId!==rentalId))throw new Error('批量丢失必须属于同一合同');if(new Set(values.map((v)=>v.rentalItemId)).size!==values.length)throw new Error('同一设备不能重复提交')
  const [[rental],items]=await Promise.all([db.select().from(rentals).where(and(eq(rentals.userId,userId),eq(rentals.id,rentalId))),db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,rentalId)))])
  if(!rental||rental.orderType!=='official'||rental.lifecycleStatus!=='active')throw new Error('仅正式有效合同可以登记丢失');const byId=new Map(items.map((i)=>[i.id,i]));const rows=values.map((value,index)=>{const item=byId.get(value.rentalItemId);if(!item)throw new Error('包含不存在的设备');dateOnly(value.date);if(item.startDate&&value.date<item.startDate)throw new Error(`${item.deviceName} 的丢失日期不能早于起租日期`);const available=availableQuantity(item);if(value.quantity>available)throw new Error(`${item.deviceName} 最多可登记丢失 ${available} 台`);return{value,item,available,amountCents:toCents(value.unitCompensation)*value.quantity,id:Date.now()*1000+index}});const finalItems=items.map((item)=>{const row=rows.find((r)=>r.item.id===item.id);return row?{...item,lostQuantity:item.lostQuantity+row.value.quantity}:item});const totalCents=toCents(rental.totalRent)+rows.reduce((s,r)=>s+r.amountCents,0);const statements:Array<Parameters<typeof db.batch>[0][number]>=[]
  for(const row of rows){const v=row.value,next=row.item.lostQuantity+v.quantity,operationNo=`${operationNumber('loss',rentalId)}-${row.id}`;statements.push(db.insert(rentalOperations).values({userId,rentalId,operationNo,operationType:'loss',status:'completed',idempotencyKey:operationIdempotencyKey({userId,rentalId,type:'loss',clientRequestId:crypto.randomUUID()}),actorUserId:actorId,actorName:name,summary:`${rental.contractNo} 登记丢失 ${row.item.deviceName} ${v.quantity} 台`,completedAt:new Date()}),db.update(rentalItems).set({lostQuantity:next,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,row.item.id))),db.insert(lossRecords).values({id:row.id,userId,rentalId,rentalItemId:row.item.id,quantity:v.quantity,lossDate:v.date,unitCompensation:fromCents(toCents(v.unitCompensation)),amount:fromCents(row.amountCents),notes:v.notes,operatorName:name}),db.insert(receivableBills).values({userId,rentalId,billNo:`LOSS-${rentalId}-${row.id}`,periodStart:v.date,periodEnd:v.date,dueDate:v.date,billType:'丢失赔偿',amount:fromCents(row.amountCents),paidAmount:'0',status:'待收',notes:`${row.item.deviceName} ${v.quantity} 台丢失赔偿`}),db.insert(rentalEvents).values({userId,rentalId,itemId:row.item.id,eventType:'设备丢失',status:'已完成',eventDate:v.date,beforeSnapshot:{availableQuantity:row.available},afterSnapshot:{availableQuantity:row.available-v.quantity,lostQuantity:next},feeAdjustment:fromCents(row.amountCents),operatorName:name,notes:v.notes}),db.insert(auditLogs).values({userId,actorUserId:actorId,actorName:name,action:'登记丢失',resourceType:'租赁合同',resourceId:String(rentalId),summary:`${rental.contractNo} 丢失 ${row.item.deviceName} ${v.quantity} 台`,metadata:{operationNo,rentalItemId:row.item.id,quantity:v.quantity,amount:fromCents(row.amountCents)}}))}
  statements.push(db.update(rentals).set({quantity:finalItems.reduce((s,i)=>s+availableQuantity(i),0),totalRent:fromCents(totalCents),status:rentalLifecycleStatus(finalItems),paymentStatus:paymentStatusFromCents(totalCents,toCents(rental.paidAmount)),updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,rentalId))));await db.batch(statements as [typeof statements[number],...Array<typeof statements[number]>]);revalidatePath('/');revalidatePath('/audit-logs')
}

export async function returnRentalItem(input: ReturnInput) {
  return returnRentalItems([input])
  const { userId, actorId, name } = await actor()
  const value = operationSchema.extend({ condition: z.enum(['完好','轻微磨损','损坏']), deductionAmount: z.number().nonnegative(), depositRefund: z.number().nonnegative(), collectionSettlement: settlementSchema, refundSettlement: settlementSchema }).parse(input)
  const [[item], items] = await Promise.all([
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId))),
  ])
  if (!item) throw new Error('设备不存在')
  dateOnly(value.date)
  if (item.startDate && value.date < item.startDate!) throw new Error('退租日期不能早于设备起租日期')
  const available = availableQuantity(item)
  if (value.quantity>available) throw new Error(`最多可退 ${available} 台`)
  const nextReturned = item.returnedQuantity + value.quantity
  const nextItems = items.map(current => current.id === item.id ? { ...current, returnedQuantity: nextReturned } : current)
  const [rental] = await db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, value.rentalId)))
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理退租')
  const availableAfter = nextItems.reduce((sum, current) => sum + availableQuantity(current), 0)
  const returnId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const requestId = crypto.randomUUID()
  const operationNo = `${operationNumber('return', value.rentalId)}-${returnId}`
  const collectedAmount = value.collectionSettlement.timing === 'now' ? value.deductionAmount : 0
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.insert(rentalOperations).values({ userId, rentalId: value.rentalId, operationNo, operationType: 'return', status: 'completed', idempotencyKey: operationIdempotencyKey({ userId, rentalId: value.rentalId, type: 'return', clientRequestId: requestId }), actorUserId: actorId, actorName: name, summary: `${rental.contractNo} 退租 ${item.deviceName} ${value.quantity} 台`, beforeSnapshot: { itemId: item.id, availableQuantity: available, contractQuantity: rental.quantity, totalRent: rental.totalRent, paidAmount: rental.paidAmount }, afterSnapshot: { itemId: item.id, availableQuantity: available - value.quantity, contractQuantity: availableAfter }, resultJson: { returnRecordId: returnId }, completedAt: new Date() }),
    db.update(rentalItems).set({returnedQuantity:nextReturned,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.insert(returnRecords).values({id:returnId,userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,returnDate:value.date,condition:value.condition,deductionAmount:String(value.deductionAmount),depositRefund:String(value.depositRefund),notes:value.notes,operatorName:name}),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, itemId: value.rentalItemId, eventType: '退租', status: '已完成', eventDate: value.date, beforeSnapshot: { availableQuantity: available }, afterSnapshot: { availableQuantity: available - value.quantity, returnedQuantity: nextReturned, condition: value.condition, collectionSettlement: value.collectionSettlement.timing, refundSettlement: value.refundSettlement.timing }, feeAdjustment: String(value.deductionAmount - value.depositRefund), operatorName: name, notes: value.notes }),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '办理退租', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 退租 ${item.deviceName} ${value.quantity} 台`, metadata: { rentalItemId: value.rentalItemId, quantity: value.quantity, condition: value.condition, deductionAmount: value.deductionAmount, depositRefund: value.depositRefund } }),
  ]
  const itemEndDate = item.endDate
  let reductionCents = 0
  if (itemEndDate && value.date < itemEndDate!) {
    const unusedDays = Math.max(0, Math.ceil((dateOnly(itemEndDate!).getTime() - dateOnly(value.date).getTime()) / 86400000))
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

export async function exchangeRentalItems(input: ExchangeInput[]) {
  const { userId, name } = await actor()
  const values = z.array(exchangeSchema).min(1).max(100).parse(input)
  const rentalId = values[0].rentalId
  if (values.some((value) => value.rentalId !== rentalId)) throw new Error('批量换机必须属于同一合同')
  if (new Set(values.map((value) => value.rentalItemId)).size !== values.length) throw new Error('同一设备不能重复提交')
  const [[rental], items] = await Promise.all([
    db.select().from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId))),
    db.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), eq(rentalItems.rentalId, rentalId))),
  ])
  if (!rental || rental.orderType !== 'official' || rental.lifecycleStatus !== 'active') throw new Error('仅正式有效合同可以办理换机')
  const byId = new Map(items.map((item) => [item.id, item]))
  const keys = ['deviceName','deviceType','deviceCode','deviceConfig','cpu','motherboard','memory','storage','graphicsCard','powerSupply','caseModel','monitorInfo','screenSize','screenResolution','refreshRate','panelType','ports','batteryInfo','adapterInfo','accessories','colorGamut'] as const
  const changes = values.map((value) => {
    const item = byId.get(value.rentalItemId)
    if (!item || availableQuantity(item) <= 0) throw new Error('包含不存在或已处置的设备')
    dateOnly(value.exchangeDate)
    if (item.startDate && value.exchangeDate < item.startDate) throw new Error('换机日期不能早于设备起租日期')
    const before = Object.fromEntries(keys.map((key) => [key, item[key]]))
    const after = { deviceName:value.newDeviceName,deviceType:value.newDeviceType,deviceCode:value.newDeviceCode,deviceConfig:value.newDeviceConfig||null,cpu:value.cpu||null,motherboard:value.motherboard||null,memory:value.memory||null,storage:value.storage||null,graphicsCard:value.graphicsCard||null,powerSupply:value.powerSupply||null,caseModel:value.caseModel||null,monitorInfo:value.monitorInfo||null,screenSize:value.screenSize||null,screenResolution:value.screenResolution||null,refreshRate:value.refreshRate||null,panelType:value.panelType||null,ports:value.ports||null,batteryInfo:value.batteryInfo||null,adapterInfo:value.adapterInfo||null,accessories:value.accessories||null,colorGamut:value.colorGamut||null }
    return { value, item, before, after }
  })
  const finalItems = items.map((item) => changes.find((change) => change.item.id === item.id) ? { ...item, ...changes.find((change) => change.item.id === item.id)!.after } : item)
  const statements: Array<Parameters<typeof db.batch>[0][number]> = changes.flatMap(({ value, item, before, after }) => [
    db.update(rentalItems).set({ ...after, updatedAt: new Date() }).where(and(eq(rentalItems.userId, userId), eq(rentalItems.id, item.id))),
    db.insert(rentalEvents).values({ userId, rentalId, eventType: '换机调拨', status: '已完成', eventDate: value.exchangeDate, itemId: item.id, beforeSnapshot: before, afterSnapshot: after, reason: value.reason, operatorName: name, notes: value.notes }),
  ])
  statements.push(db.update(rentals).set({ deviceName: finalItems.map((item) => item.deviceName).join('、'), deviceType: finalItems.length === 1 ? finalItems[0].deviceType : '多设备', updatedAt: new Date() }).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId))))
  await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>])
  revalidatePath('/')
}

export async function reportLostItem(input: LossInput) {
  const { userId, actorId, name } = await actor()
  const value = operationSchema.extend({ unitCompensation: z.number().positive() }).parse(input)
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
  const lossId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 1000
  const operationNo = `${operationNumber('loss', value.rentalId)}-${lossId}`
  const nextQuantity = nextItems.reduce((sum, current) => sum + availableQuantity(current), 0)
  const nextTotalCents = Math.round(Number(rental.totalRent) * 100) + Math.round(amount * 100)
  await db.batch([
    db.insert(rentalOperations).values({ userId, rentalId: value.rentalId, operationNo, operationType: 'loss', status: 'completed', idempotencyKey: operationIdempotencyKey({ userId, rentalId: value.rentalId, type: 'loss', clientRequestId: crypto.randomUUID() }), actorUserId: actorId, actorName: name, summary: `${rental.contractNo} 登记丢失 ${item.deviceName} ${value.quantity} 台`, beforeSnapshot: { itemId: item.id, availableQuantity: available, contractQuantity: rental.quantity, totalRent: rental.totalRent }, afterSnapshot: { itemId: item.id, availableQuantity: available - value.quantity, contractQuantity: nextQuantity, totalRent: nextTotalCents / 100 }, resultJson: { lossRecordId: lossId }, completedAt: new Date() }),
    db.update(rentalItems).set({lostQuantity:nextLost,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id))),
    db.insert(lossRecords).values({id:lossId,userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,lossDate:value.date,unitCompensation:String(value.unitCompensation),amount:String(amount),notes:value.notes,operatorName:name}),
    db.insert(receivableBills).values({ userId, rentalId: value.rentalId, billNo: `LOSS-${value.rentalId}-${lossId}`, periodStart: value.date, periodEnd: value.date, dueDate: value.date, billType: '丢失赔偿', amount: String(amount), paidAmount: '0', status: '待收', notes: `${item.deviceName} ${value.quantity} 台丢失赔偿` }),
    db.insert(rentalEvents).values({ userId, rentalId: value.rentalId, itemId: item.id, eventType: '设备丢失', status: '已完成', eventDate: value.date, beforeSnapshot: { availableQuantity: available }, afterSnapshot: { availableQuantity: available - value.quantity, lostQuantity: nextLost }, feeAdjustment: String(amount), operatorName: name, notes: value.notes }),
    db.update(rentals).set({quantity:nextQuantity,totalRent:String(nextTotalCents / 100),status:rentalLifecycleStatus(nextItems),paymentStatus:Number(rental.paidAmount) >= nextTotalCents / 100 ? '已结清' : Number(rental.paidAmount) > 0 ? '部分收款' : '待收款',updatedAt:new Date()}).where(and(eq(rentals.userId,userId),eq(rentals.id,value.rentalId))),
    db.insert(auditLogs).values({ userId, actorUserId: actorId, actorName: name, action: '登记丢失', resourceType: '租赁合同', resourceId: String(value.rentalId), summary: `${rental.contractNo} 丢失 ${item.deviceName} ${value.quantity} 台，新增应收 ${amount.toFixed(2)} 元`, metadata: { operationNo, rentalItemId: item.id, quantity: value.quantity, amount } }),
  ])
  revalidatePath('/')
}
