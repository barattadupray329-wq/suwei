import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { buildBackup, listCloudSnapshots, saveCloudSnapshot } from '@/lib/backup'
import { safeError } from '@/lib/errors'

export async function GET(request: Request) {
  try {
    const { userId, role } = await getAccessContext('系统设置')
    if (role !== 'admin') return NextResponse.json({ error: '仅管理员可访问备份' }, { status: 403 })
    const url = new URL(request.url)
    if (url.searchParams.get('download') === 'json') {
      const payload = await buildBackup(userId)
      return new NextResponse(JSON.stringify(payload, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="rental-backup-${payload.createdAt.slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ snapshots: await listCloudSnapshots(userId) })
  } catch (error) { const safe=safeError(error,'读取备份失败');return NextResponse.json({ error: safe.message }, { status: safe.status }) }
}

export async function POST(request: Request) {
  try {
    const { userId, role } = await getAccessContext('系统设置')
    if (role !== 'admin') return NextResponse.json({ error: '仅管理员可创建备份' }, { status: 403 })
    const body = await request.json().catch(() => ({})) as { type?: string }
    return NextResponse.json({ snapshot: await saveCloudSnapshot(userId, body.type === 'exit' ? 'exit' : 'manual') })
  } catch (error) { const safe=safeError(error,'创建备份失败');return NextResponse.json({ error: safe.message }, { status: safe.status }) }
}
