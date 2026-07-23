import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { buildBackup, listCloudSnapshots, saveCloudSnapshot } from '@/lib/backup'
import { safeError } from '@/lib/errors'
import { isTrustedMutationRequest } from '@/lib/request-security'

export async function GET(request: Request) {
  try {
    const { userId, role } = await getAccessContext('系统设置')
    if (role === 'employee') return NextResponse.json({ error: '仅管理员可访问备份' }, { status: 403 })
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
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
    const { userId, role } = await getAccessContext('系统设置')
    if (role === 'employee') return NextResponse.json({ error: '仅管理员可创建备份' }, { status: 403 })
    return NextResponse.json({ snapshot: await saveCloudSnapshot(userId, 'manual') })
  } catch (error) { const safe=safeError(error,'创建备份失败');return NextResponse.json({ error: safe.message }, { status: safe.status }) }
}
