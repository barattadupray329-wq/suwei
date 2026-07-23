import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { accountLedger, businessSettings, buyoutRecords, lossRecords, organizationMembers, paymentRecords, receivableBills, rentalEvents, rentalItems, rentals, renewalRecords, returnRecords, user } from '@/lib/db/schema'
import { safeError } from '@/lib/errors'

export const runtime = 'nodejs'

const querySchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })

export async function GET(request: NextRequest) {
  try {
    const access = await getAccessContext('系统设置')
    if (access.role === 'employee') return NextResponse.json({ error: '仅管理员可以导出完整数据' }, { status: 403 })
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) return NextResponse.json({ error: '日期格式无效' }, { status: 400 })
    const { from, to } = parsed.data
    if (from && to && from > to) return NextResponse.json({ error: '开始日期不能晚于结束日期' }, { status: 400 })
    const userId = access.userId
    const ranged = (owner: Parameters<typeof eq>[0], date: Parameters<typeof gte>[0]) => and(eq(owner, userId), ...(from ? [gte(date, from)] : []), ...(to ? [lte(date, to)] : []))
    const [rentalRows, itemRows, paymentRows, billRows, ledgerRows, renewalRows, buyoutRows, returnRows, lossRows, eventRows, memberRows, settings] = await Promise.all([
      db.select().from(rentals).where(ranged(rentals.userId, rentals.startDate)).orderBy(asc(rentals.id)),
      db.select().from(rentalItems).where(eq(rentalItems.userId, userId)).orderBy(asc(rentalItems.rentalId), asc(rentalItems.id)),
      db.select().from(paymentRecords).where(ranged(paymentRecords.userId, paymentRecords.paymentDate)).orderBy(asc(paymentRecords.paymentDate)),
      db.select().from(receivableBills).where(ranged(receivableBills.userId, receivableBills.dueDate)).orderBy(asc(receivableBills.dueDate)),
      db.select().from(accountLedger).where(ranged(accountLedger.userId, accountLedger.entryDate)).orderBy(asc(accountLedger.entryDate)),
      db.select().from(renewalRecords).where(ranged(renewalRecords.userId, renewalRecords.renewalDate)).orderBy(asc(renewalRecords.renewalDate)),
      db.select().from(buyoutRecords).where(ranged(buyoutRecords.userId, buyoutRecords.buyoutDate)).orderBy(asc(buyoutRecords.buyoutDate)),
      db.select().from(returnRecords).where(ranged(returnRecords.userId, returnRecords.returnDate)).orderBy(asc(returnRecords.returnDate)),
      db.select().from(lossRecords).where(ranged(lossRecords.userId, lossRecords.lossDate)).orderBy(asc(lossRecords.lossDate)),
      db.select().from(rentalEvents).where(ranged(rentalEvents.userId, rentalEvents.eventDate)).orderBy(asc(rentalEvents.eventDate)),
      db.select({ name: user.name, username: user.username, phone: user.phoneNumber, email: user.email, role: organizationMembers.role, active: organizationMembers.active, permissions: organizationMembers.permissions, updatedAt: organizationMembers.updatedAt }).from(organizationMembers).innerJoin(user, eq(user.id, organizationMembers.memberUserId)).where(eq(organizationMembers.ownerId, userId)),
      db.select().from(businessSettings).where(eq(businessSettings.userId, userId)).limit(1),
    ])
    const payload = { format: 'suwei-backup-v1', exportedAt: new Date().toISOString(), range: { from: from ?? null, to: to ?? null }, settings: settings[0] ?? null, rentals: rentalRows, rentalItems: itemRows, payments: paymentRows, receivableBills: billRows, accountLedger: ledgerRows, renewals: renewalRows, buyouts: buyoutRows, returns: returnRows, losses: lossRows, rentalEvents: eventRows, members: memberRows }
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
    return NextResponse.json(payload, { headers: { 'Content-Disposition': `attachment; filename="suwei-backup-${stamp}.json"`, 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const safe = safeError(error, '导出失败，请稍后重试')
    return NextResponse.json({ error: safe.message }, { status: safe.status })
  }
}
