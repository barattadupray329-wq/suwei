import { NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { backupChecksum, countBackupRecords, restoreBackup, validateBackup } from '@/lib/backup'

export async function POST(request: Request) {
  try {
    const { userId, role } = await getAccessContext('系统设置')
    if (role !== 'admin') return NextResponse.json({ error: '仅管理员可恢复数据' }, { status: 403 })
    const body = await request.json() as { mode?: 'preview' | 'restore'; payload?: unknown; confirmation?: string }
    const payload = validateBackup(body.payload, userId)
    const summary = { createdAt: payload.createdAt, schemaVersion: payload.schemaVersion, recordCount: countBackupRecords(payload), checksum: backupChecksum(payload), counts: Object.fromEntries(Object.entries(payload.tables).map(([name, rows]) => [name, rows.length])) }
    if (body.mode !== 'restore') return NextResponse.json({ summary })
    if (body.confirmation !== '确认恢复') return NextResponse.json({ error: '请输入“确认恢复”后再执行' }, { status: 400 })
    return NextResponse.json({ restored: await restoreBackup(userId, payload) })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '恢复失败，当前数据未改变' }, { status: 400 }) }
}
