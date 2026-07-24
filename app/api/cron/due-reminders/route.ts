import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processAutomaticDueReminders } from '@/app/actions/sms-reminders'

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
  const result = await processAutomaticDueReminders()
  return NextResponse.json({ ok: true, ...result })
}
