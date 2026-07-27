import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processAutomaticDueReminders, processAutomaticOverdueReminders } from '@/app/actions/sms-reminders'
import { processAutomaticOverdueBills } from '@/lib/overdue-billing'

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
  const billing = await processAutomaticOverdueBills()
  const [due, overdue] = await Promise.all([
    processAutomaticDueReminders(),
    processAutomaticOverdueReminders(),
  ])
  return NextResponse.json({ ok: true, billing, due, overdue })
}
