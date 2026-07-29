import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, rentalEvents, rentalItems, rentals } from '@/lib/db/schema'
import { and, eq, max, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BUILD_VERSION = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

export async function GET() {
  try {
    const access = await getAccessContext()
    const [rentalState, itemState, eventState, ledgerState] = await Promise.all([
      db.select({ count: sql<number>`count(*)`, changed: max(rentals.updatedAt), newest: max(rentals.id) }).from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.orderType, 'official'))),
      db.select({ count: sql<number>`count(*)`, changed: max(rentalItems.updatedAt), newest: max(rentalItems.id) }).from(rentalItems).where(eq(rentalItems.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(rentalEvents.createdAt), newest: max(rentalEvents.id) }).from(rentalEvents).where(eq(rentalEvents.userId, access.userId)),
      db.select({ count: sql<number>`count(*)`, changed: max(accountLedger.createdAt), newest: max(accountLedger.id) }).from(accountLedger).where(eq(accountLedger.userId, access.userId)),
    ])
    const state = [rentalState[0], itemState[0], eventState[0], ledgerState[0]]
      .map((row) => `${row?.count ?? 0}:${row?.newest ?? 0}:${row?.changed instanceof Date ? row.changed.getTime() : row?.changed ?? 0}`)
      .join('|')
    return NextResponse.json({ version: BUILD_VERSION, state }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } })
  }
}
