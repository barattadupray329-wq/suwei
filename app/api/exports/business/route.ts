import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import {
  accountLedger, businessSettings, buyoutRecords, lossRecords, organizationMembers, paymentRecords,
  receivableBills, rentalEvents, rentalItems, rentals, renewalRecords, returnRecords, user,
} from '@/lib/db/schema'
import { safeError } from '@/lib/errors'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessContext('系统设置')
    if (access.role === 'employee') return NextResponse.json({ error: '仅管理员可以导出完整数据' }, { status: 403 })
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: '日期格式无效' }, { status: 400 })
    const { from, to } = parsed.data
    if (from && to && from > to) return NextResponse.json({ error: '开始日期不能晚于结束日期' }, { status: 400 })
    const userId = access.userId
    const rentalFilters = [eq(rentals.userId, userId)]
    if (from) rentalFilters.push(gte(rentals.startDate, from))
    if (to) rentalFilters.push(lte(rentals.startDate, to))
    const dateFilters = (owner: Parameters<typeof eq>[0], column: Parameters<typeof gte>[0]) => and(
      eq(owner, userId),
      ...(from ? [gte(column, from)] : []),
      ...(to ? [lte(column, to)] : []),
    )

    const [
      rentalRows, itemRows, paymentRows, billRows, ledgerRows, renewalRows, buyoutRows,
      returnRows, lossRows, eventRows, memberRows, settingsRows,
    ] = await Promise.all([
      db.select().from(rentals).where(and(...rentalFilters)).orderBy(asc(rentals.id)),
      db.select().from(rentalItems).where(eq(rentalItems.userId, userId)).orderBy(asc(rentalItems.id)),
      db.select().from(paymentRecords).where(dateFilters(paymentRecords.userId, paymentRecords.paymentDate)).orderBy(asc(paymentRecords.id)),
      db.select().from(receivableBills).where(dateFilters(receivableBills.userId, receivableBills.dueDate)).orderBy(asc(receivableBills.id)),
      db.select().from(accountLedger).where(dateFilters(accountLedger.userId, accountLedger.entryDate)).orderBy(asc(accountLedger.id)),
      db.select().from(renewalRecords).where(dateFilters(renewalRecords.userId, renewalRecords.renewalDate)).orderBy(asc(renewalRecords.id)),
      db.select().from(buyoutRecords).where(dateFilters(buyoutRecords.userId, buyoutRecords.buyoutDate)).orderBy(asc(buyoutRecords.id)),
      db.select().from(returnRecords).where(dateFilters(returnRecords.userId, returnRecords.returnDate)).orderBy(asc(returnRecords.id)),
      db.select().from(lossRecords).where(dateFilters(lossRecords.userId, lossRecords.lossDate)).orderBy(asc(lossRecords.id)),
      db.select().from(rentalEvents).where(dateFilters(rentalEvents.userId, rentalEvents.eventDate)).orderBy(asc(rentalEvents.id)),
      db.select({ name: user.name, email: user.email, role: organizationMembers.role, active: organizationMembers.active, permissions: organizationMembers.permissions, updatedAt: organizationMembers.updatedAt })
        .from(organizationMembers).innerJoin(user, eq(user.id, organizationMembers.memberUserId)).where(eq(organizationMembers.ownerId, userId)),
      db.select().from(businessSettings).where(eq(businessSettings.userId, userId)),
    ])

    const payload = {
      format: 'suwei-cloudflare-export', version: 1, exportedAt: new Date().toISOString(), filters: { from, to },
      counts: {
        rentals: rentalRows.length, rentalItems: itemRows.length, payments: paymentRows.length,
        bills: billRows.length, ledger: ledgerRows.length, renewals: renewalRows.length,
        buyouts: buyoutRows.length, returns: returnRows.length, losses: lossRows.length,
        events: eventRows.length, members: memberRows.length,
      },
      data: {
        rentals: rentalRows, rentalItems: itemRows, paymentRecords: paymentRows, receivableBills: billRows,
        accountLedger: ledgerRows, renewalRecords: renewalRows, buyoutRecords: buyoutRows,
        returnRecords: returnRows, lossRecords: lossRows, rentalEvents: eventRows,
        organizationMembers: memberRows, businessSettings: settingsRows,
      },
    }
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="suwei-backup-${stamp}.json"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const safe = safeError(error, '导出失败，请稍后重试')
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}
