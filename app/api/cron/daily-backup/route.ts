import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rentals } from '@/lib/db/schema'
import { ensureDailyCloudSnapshot } from '@/lib/backup'
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
    const results = []
    for (const { userId } of userRows) {
      try {
        const { created } = await ensureDailyCloudSnapshot(userId)
        results.push({ userId, ok: true, created })
      } catch (error) {
        const message = error instanceof Error ? error.message : '每日备份失败'
        results.push({ userId, ok: false, created: false, message })
        console.error('[v0] Daily backup failed for tenant', { userId, message })
      }
    }
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error('[v0] Daily backup task failed:', error)
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '每日备份失败' }, { status: 500 })
  }
}
