import { timingSafeEqual } from 'node:crypto'
import { and, eq, notInArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { processAutomaticDueReminders, processAutomaticOverdueReminders } from '@/app/actions/sms-reminders'
import { db } from '@/lib/db'
import { rentals } from '@/lib/db/schema'
import { ensureOverdueRentBills } from '@/lib/overdue-rent-billing'
import { fromCents, toCents } from '@/lib/rental-calculations'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

// 每晚兜底补算时，一次只处理一个店铺的一小批合同。历史上这里是"每个用户跑一次不带 rentalId 的
// 全店铺全量扫描"——那次扫描要拉出该商户全部在租合同及其设备/处置/账单再逐一算账期，账期积压越久
// 计算量越大，很容易撞上 Worker CPU 上限而抛错；而外层对每个用户是 try/catch 静默吞错，一旦某店
// 的全量扫描失败，该店当晚所有"从没被操作过"的过期合同就整批被跳过、永远搁浅。改成按合同分块，
// 每批只扫这一小撮合同，单批失败也只跳过这一批、不拖垮整店。
const HEAL_CHUNK_SIZE = 20

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
    for (const { userId } of userRows) {
      // 与 ensureOverdueRentBills 的筛选保持一致，先取出这个店铺所有"可能逾期"的正式月租在租合同 id，
      // 再按小批次逐块补算，避免一次性全量扫描撑爆 CPU。
      const candidates = await db.select({ id: rentals.id }).from(rentals).where(and(
        eq(rentals.userId, userId),
        eq(rentals.orderType, 'official'),
        eq(rentals.lifecycleStatus, 'active'),
        eq(rentals.billingType, 'monthly'),
        notInArray(rentals.status, ['已关闭', '已完成']),
      ))
      const ids = candidates.map((row) => row.id)
      let created = 0
      let amountCents = 0
      let failedContracts = 0
      for (let offset = 0; offset < ids.length; offset += HEAL_CHUNK_SIZE) {
        const chunk = ids.slice(offset, offset + HEAL_CHUNK_SIZE)
        try {
          const result = await ensureOverdueRentBills(userId, undefined, chunk)
          created += result.created
          amountCents += toCents(result.amount)
        } catch (error) {
          failedContracts += chunk.length
          const message = error instanceof Error ? error.message : '自动补账失败'
          console.error('[v0] Automatic overdue billing chunk failed', { userId, chunkSize: chunk.length, message })
        }
      }
      const ok = failedContracts === 0
      billing.push({ userId, ok, created, amount: fromCents(amountCents), failedContracts })
      console.info('[v0] Automatic overdue billing completed', { userId, created, amount: fromCents(amountCents), failedContracts })
    }
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
