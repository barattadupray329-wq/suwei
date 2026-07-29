import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processAutomaticDueReminders, processAutomaticOverdueReminders } from '@/app/actions/sms-reminders'
import { db } from '@/lib/db'
import { rentals } from '@/lib/db/schema'
import { ensureOverdueRentBills } from '@/lib/overdue-rent-billing'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') ?? ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!secret || !provided || secret.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, message: '未授权' }, { status: 401 })
  const userRows = await db.selectDistinct({ userId: rentals.userId }).from(rentals)
  const billing = []
  for (const { userId } of userRows) billing.push({ userId, ...await ensureOverdueRentBills(userId) })
  const [due, overdue] = await Promise.all([
    processAutomaticDueReminders(),
    processAutomaticOverdueReminders(),
  ])
  return NextResponse.json({ ok: true, billing, due, overdue })
}
