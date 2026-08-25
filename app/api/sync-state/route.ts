import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, receivableBills, renewalRecords, rentalEvents, rentalItems, rentals } from '@/lib/db/schema'
import { and, eq, max, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BUILD_VERSION = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

export async function GET() {
  try {
    const access = await getAccessContext()
    // 这 8 条查询各自读取的数据量都很小（本店全部相关表加起来不到千行），真正的成本是
    // 「每条查询都是一次独立的 D1 网络往返」。db.batch 会把它们打包成一次往返请求发给 D1，
    // 每条语句仍然独立执行、返回结果完全不变，纯粹是传输层优化：不改变任何查询逻辑、
    // 不触碰任何写入路径，对现有系统零风险，只是让这次轮询的响应更快。
    const [rentalState, itemState, eventState, ledgerState, billState, renewalState, overdueState, outstandingState] = await db.batch([
      db.select({ count: sql<number>`count(*)`, changed: max(rentals.updatedAt), newest: max(rentals.id) }).from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.orderType, 'official'))),
      db.select({ count: sql<number>`count(*)`, changed: max(rentalItems.updatedAt), newest: max(rentalItems.id) }).from(rentalItems).where(eq(rentalItems.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(rentalEvents.createdAt), newest: max(rentalEvents.id) }).from(rentalEvents).where(eq(rentalEvents.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(accountLedger.createdAt), newest: max(accountLedger.id) }).from(accountLedger).where(eq(accountLedger.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(receivableBills.updatedAt), newest: max(receivableBills.id) }).from(receivableBills).where(eq(receivableBills.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(sql<number>`coalesce(${renewalRecords.reversedAt}, ${renewalRecords.createdAt})`), newest: max(renewalRecords.id) }).from(renewalRecords).where(eq(renewalRecords.userId, access.userId)),
      db.select({ total: sql<number>`coalesce(sum(case when ${rentals.endDate} < date('now', '+8 hours') and ${rentals.status} not in ('买断', '已买断', '已退租', '已退回', '已结束', '已关闭', '已完成', '丢失') and round(cast(${rentals.totalRent} as real) - cast(${rentals.paidAmount} as real), 2) > 0 then round(cast(${rentals.totalRent} as real) - cast(${rentals.paidAmount} as real), 2) else 0 end), 0)` }).from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'))),
      db.select({ total: sql<number>`coalesce(sum(case when round(cast(${rentals.totalRent} as real) - cast(${rentals.paidAmount} as real), 2) > 0 then round(cast(${rentals.totalRent} as real) - cast(${rentals.paidAmount} as real), 2) else 0 end), 0)` }).from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.orderType, 'official'), eq(rentals.lifecycleStatus, 'active'))),
    ]) as [
      { count: number; changed: unknown; newest: number | null }[],
      { count: number; changed: unknown; newest: number | null }[],
      { count: number; changed: unknown; newest: number | null }[],
      { count: number; changed: unknown; newest: number | null }[],
      { count: number; changed: unknown; newest: number | null }[],
      { count: number; changed: unknown; newest: number | null }[],
      { total: number }[],
      { total: number }[],
    ]
    const state = [rentalState[0], itemState[0], eventState[0], ledgerState[0], billState[0], renewalState[0]]
      .map((row) => `${row?.count ?? 0}:${row?.newest ?? 0}:${row?.changed instanceof Date ? row.changed.getTime() : row?.changed ?? 0}`)
      .join('|')
    return NextResponse.json({ version: BUILD_VERSION, state, overdueReceivable: Number(overdueState[0]?.total ?? 0), outstandingReceivable: Number(outstandingState[0]?.total ?? 0) }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } })
  }
}
