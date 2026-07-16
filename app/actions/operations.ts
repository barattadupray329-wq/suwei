'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { lossRecords, rentalItems, rentals, returnRecords } from '@/lib/db/schema'

async function actor() {
  const context = await getAccessContext('租赁操作')
  return { userId: context.userId, name: context.actorName }
}

const operationSchema = z.object({ rentalId: z.number().int().positive(), rentalItemId: z.number().int().positive(), quantity: z.number().int().positive(), date: z.string().min(1), notes: z.string().optional() })
export type ReturnInput = z.infer<typeof operationSchema> & { condition: '完好'|'轻微磨损'|'损坏'; deductionAmount: number; depositRefund: number }
export type LossInput = z.infer<typeof operationSchema> & { unitCompensation: number }

async function updateRentalStatus(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, rentalId: number) {
  const items = await tx.select().from(rentalItems).where(and(eq(rentalItems.userId, userId), eq(rentalItems.rentalId, rentalId)))
  const total = items.reduce((s, i) => s + i.quantity, 0)
  const returned = items.reduce((s, i) => s + i.returnedQuantity, 0)
  const lost = items.reduce((s, i) => s + i.lostQuantity, 0)
  const bought = items.reduce((s, i) => s + i.boughtOutQuantity, 0)
  const handled = returned + lost + bought
  const status = handled >= total ? (lost ? '已结束' : bought === total ? '买断' : '已退租') : returned ? '部分退租' : lost ? '部分丢失' : bought ? '部分买断' : '在租'
  await tx.update(rentals).set({ status, updatedAt: new Date() }).where(and(eq(rentals.userId, userId), eq(rentals.id, rentalId)))
}

export async function returnRentalItem(input: ReturnInput) {
  const { userId, name } = await actor()
  const value = operationSchema.extend({ condition: z.enum(['完好','轻微磨损','损坏']), deductionAmount: z.number().nonnegative(), depositRefund: z.number().nonnegative() }).parse(input)
  await db.transaction(async tx => {
    const [item] = await tx.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId)))
    if (!item) throw new Error('设备不存在')
    const available = item.quantity-item.boughtOutQuantity-item.returnedQuantity-item.lostQuantity
    if (value.quantity>available) throw new Error(`最多可退 ${available} 台`)
    await tx.update(rentalItems).set({returnedQuantity:item.returnedQuantity+value.quantity,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id)))
    await tx.insert(returnRecords).values({userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,returnDate:value.date,condition:value.condition,deductionAmount:String(value.deductionAmount),depositRefund:String(value.depositRefund),notes:value.notes,operatorName:name})
    await updateRentalStatus(tx,userId,value.rentalId)
  })
  revalidatePath('/')
}

export async function reportLostItem(input: LossInput) {
  const { userId, name } = await actor()
  const value = operationSchema.extend({ unitCompensation: z.number().positive() }).parse(input)
  await db.transaction(async tx => {
    const [item] = await tx.select().from(rentalItems).where(and(eq(rentalItems.userId,userId),eq(rentalItems.rentalId,value.rentalId),eq(rentalItems.id,value.rentalItemId)))
    if (!item) throw new Error('设备不存在')
    const available = item.quantity-item.boughtOutQuantity-item.returnedQuantity-item.lostQuantity
    if (value.quantity>available) throw new Error(`最多可登记丢失 ${available} 台`)
    await tx.update(rentalItems).set({lostQuantity:item.lostQuantity+value.quantity,updatedAt:new Date()}).where(and(eq(rentalItems.userId,userId),eq(rentalItems.id,item.id)))
    await tx.insert(lossRecords).values({userId,rentalId:value.rentalId,rentalItemId:value.rentalItemId,quantity:value.quantity,lossDate:value.date,unitCompensation:String(value.unitCompensation),amount:String(value.unitCompensation*value.quantity),notes:value.notes,operatorName:name})
    await updateRentalStatus(tx,userId,value.rentalId)
  })
  revalidatePath('/')
}
