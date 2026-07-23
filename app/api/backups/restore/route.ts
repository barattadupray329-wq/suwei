import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getStoreAccessContext } from '@/lib/access'
import { apiError, parseJson } from '@/lib/api-security'
import { backupChecksum, countBackupRecords, restoreBackup, validateBackup } from '@/lib/backup'
import { safeError } from '@/lib/errors'
import { contentLengthExceeds, isTrustedMutationRequest } from '@/lib/request-security'

const MAX_RESTORE_BYTES = 10 * 1024 * 1024
const restoreRequestSchema = z.object({
  mode: z.enum(['preview', 'restore']).default('preview'),
  payload: z.unknown(),
  confirmation: z.string().max(20).optional(),
}).strict()

function translateRestoreError(error: unknown) {
  const raw = error instanceof Error ? error.message : '恢复失败'
  if (raw.includes('toISOString is not a function')) return '备份中的时间字段格式不正确，恢复已停止，现有数据未被修改'
  if (raw.includes('duplicate key')) return '备份中存在重复编号，恢复已停止，现有数据未被修改'
  if (raw.includes('violates not-null constraint')) return '备份缺少必要字段，恢复已停止，现有数据未被修改'
  if (raw.includes('invalid input syntax')) return '备份中存在格式错误的数据，恢复已停止，现有数据未被修改'
  const safe = safeError(error, '备份内容无效或恢复失败，现有数据未被修改')
  return safe.message
}

export async function POST(request: Request) {
  try {
    if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: '请求来源无效' }, { status: 403 })
    if (contentLengthExceeds(request, MAX_RESTORE_BYTES)) return NextResponse.json({ error: '备份文件过大，最大支持 10 MB' }, { status: 413 })
    const { userId, role } = await getStoreAccessContext('系统设置')
    if (role === 'employee') return NextResponse.json({ error: '仅管理员可恢复数据' }, { status: 403 })
    const body = await parseJson(request, restoreRequestSchema, MAX_RESTORE_BYTES)
    const payload = validateBackup(body.payload, userId)
    const summary = { createdAt: payload.createdAt, schemaVersion: payload.schemaVersion, recordCount: countBackupRecords(payload), checksum: backupChecksum(payload), counts: Object.fromEntries(Object.entries(payload.tables).map(([name, rows]) => [name, rows.length])) }
    if (body.mode !== 'restore') return NextResponse.json({ summary })
    if (body.confirmation !== '确认恢复') return NextResponse.json({ error: '请输入“确认恢复”后再执行' }, { status: 400 })
    return NextResponse.json({ restored: await restoreBackup(userId, payload) })
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError')) return apiError(error, '备份请求格式无效')
    return NextResponse.json({ error: translateRestoreError(error) }, { status: 400 })
  }
}
