import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processAutomaticDueReminders, processAutomaticOverdueReminders } from '@/app/actions/sms-reminders'
import { db } from '@/lib/db'
import { rentals } from '@/lib/db/schema'
import { ensureOverdueRentBills } from '@/lib/overdue-rent-billing'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const env = getCloudflareContext().env as CloudflareEnv & { CRON_SECRET?: string }
  const secret = env.CRON_SECRET ?? process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') ?? ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!secret || !provided || secret.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(secret), Buffer.from(provided))
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, message: '未授权' }, { status: 401 })
  try {
    const userRows = await db.selectDistinct({ userId: rentals.userId }).from(rentals)
    const billing = []
    for (const { userId } of userRows) billing.push({ userId, ...await ensureOverdueRentBills(userId) })
    const [due, overdue] = await Promise.all([
      processAutomaticDueReminders(),
      processAutomaticOverdueReminders(),
    ])
    return NextResponse.json({ ok: true, billing, due, overdue })
  } catch (error) {
    console.error('[v0] Automatic billing task failed:', error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '自动补账失败' }, { status: 500 })
  }
}
