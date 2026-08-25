import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'
import { computeDailySnapshotsToPrune, MAX_MANUAL_SNAPSHOTS, MAX_PRE_RESTORE_SNAPSHOTS, shanghaiDateKey } from '@/lib/backup-policy'
import { accountLedger, backupSnapshots, businessSettings, buyoutRecords, contractSnapshots, customerPortals, lossRecords, notificationPolicies, paymentAllocations, paymentDiscounts, paymentRecords, receivableBills, renewalAdjustments, renewalRecords, rentalEvents, rentalItems, rentalOperations, rentals, returnRecords, smsDeliveryLogs } from '@/lib/db/schema'

export const BACKUP_VERSION = 3
export const backupTables = { rentals, rentalItems, buyoutRecords, renewalRecords, renewalAdjustments, paymentRecords, paymentDiscounts, receivableBills, paymentAllocations, accountLedger, rentalEvents, returnRecords, lossRecords, rentalOperations, notificationPolicies, smsDeliveryLogs, businessSettings, contractSnapshots, customerPortals } as const
export type BackupPayload = { format: 'suwei-rental-backup'; schemaVersion: number; createdAt: string; userId: string; tables: Record<string, unknown[]> }

export async function buildBackup(userId: string): Promise<BackupPayload> {
  const entries = await Promise.all(Object.entries(backupTables).map(async ([name, table]) => [name, await db.select().from(table).where(eq(table.userId, userId))] as const))
  return { format: 'suwei-rental-backup', schemaVersion: BACKUP_VERSION, createdAt: new Date().toISOString(), userId, tables: Object.fromEntries(entries) }
}
export function backupChecksum(payload: BackupPayload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex') }
export function countBackupRecords(payload: BackupPayload) { return Object.values(payload.tables).reduce((sum, rows) => sum + rows.length, 0) }
export function validateBackup(value: unknown, userId: string) {
  if (!value || typeof value !== 'object') throw new Error('备份文件格式无效')
  const payload = value as BackupPayload
  if (payload.format !== 'suwei-rental-backup') throw new Error('不是本系统生成的恢复包')
  if (![1, 2, BACKUP_VERSION].includes(payload.schemaVersion)) throw new Error(`备份版本 ${payload.schemaVersion} 与当前版本 ${BACKUP_VERSION} 不兼容`)
  if (payload.userId !== userId) throw new Error('备份所属账号与当前门店不匹配')
  if (!payload.tables || typeof payload.tables !== 'object') throw new Error('备份缺少数据表')
  for (const name of Object.keys(backupTables)) {
    if (payload.schemaVersion === 1 && ['rentalOperations', 'notificationPolicies', 'smsDeliveryLogs'].includes(name) && payload.tables[name] === undefined) payload.tables[name] = []
    if (payload.schemaVersion < 3 && name === 'paymentDiscounts' && payload.tables[name] === undefined) payload.tables[name] = []
    if (!Array.isArray(payload.tables[name])) throw new Error(`备份缺少数据表：${name}`)
  }
  return payload
}
// 三类快照各自独立保留策略：
// - daily:YYYY-MM-DD：按分层策略保留（近14天全留，15-90天每周1份，91-365天每月1份）
// - manual：手动备份，固定保留最近 MAX_MANUAL_SNAPSHOTS 份
// - pre-restore：恢复前自动保护点，固定保留最近 MAX_PRE_RESTORE_SNAPSHOTS 份
async function pruneCappedSnapshots(userId: string, backupType: string, max: number) {
  const stale = await db.select({ id: backupSnapshots.id }).from(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), eq(backupSnapshots.backupType, backupType))).orderBy(desc(backupSnapshots.createdAt), desc(backupSnapshots.id)).offset(max)
  if (stale.length) await db.delete(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), inArray(backupSnapshots.id, stale.map((row) => row.id))))
}

async function pruneDailySnapshots(userId: string) {
  const rows = await db.select({ id: backupSnapshots.id, backupType: backupSnapshots.backupType }).from(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), like(backupSnapshots.backupType, 'daily:%')))
  const snapshots = rows.map((row) => ({ id: row.id, dateKey: row.backupType.slice('daily:'.length) }))
  const toPrune = computeDailySnapshotsToPrune(snapshots)
  if (toPrune.length) await db.delete(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), inArray(backupSnapshots.id, toPrune)))
}

export async function saveCloudSnapshot(userId: string, backupType = 'manual') {
  const payload = await buildBackup(userId)
  const [snapshot] = await db.insert(backupSnapshots).values({ userId, backupType, schemaVersion: BACKUP_VERSION, recordCount: countBackupRecords(payload), checksum: backupChecksum(payload), payload }).returning()
  if (backupType === 'manual') await pruneCappedSnapshots(userId, 'manual', MAX_MANUAL_SNAPSHOTS)
  else if (backupType === 'pre-restore') await pruneCappedSnapshots(userId, 'pre-restore', MAX_PRE_RESTORE_SNAPSHOTS)
  return snapshot
}

export async function ensureDailyCloudSnapshot(userId: string) {
  const backupType = `daily:${shanghaiDateKey()}`
  const [existing] = await db.select().from(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), eq(backupSnapshots.backupType, backupType))).limit(1)
  if (existing) return { created: false, snapshot: existing }
  const payload = await buildBackup(userId)
  const [snapshot] = await db.insert(backupSnapshots).values({ userId, backupType, schemaVersion: BACKUP_VERSION, recordCount: countBackupRecords(payload), checksum: backupChecksum(payload), payload }).returning()
  await pruneDailySnapshots(userId)
  return { created: true, snapshot }
}

// 分层保留后总量上限约为：14（每日全留）+ 11（周度，90天内约11周）+ 9（月度，365天内约9个月）
// + MAX_MANUAL_SNAPSHOTS + MAX_PRE_RESTORE_SNAPSHOTS，取整为 100 留有余量
const SNAPSHOT_LIST_LIMIT = 100
export async function listCloudSnapshots(userId: string) { return db.select({ id: backupSnapshots.id, backupType: backupSnapshots.backupType, schemaVersion: backupSnapshots.schemaVersion, recordCount: backupSnapshots.recordCount, checksum: backupSnapshots.checksum, status: backupSnapshots.status, createdAt: backupSnapshots.createdAt }).from(backupSnapshots).where(eq(backupSnapshots.userId, userId)).orderBy(desc(backupSnapshots.createdAt), desc(backupSnapshots.id)).limit(SNAPSHOT_LIST_LIMIT) }
export async function getCloudSnapshot(userId: string, id: number) { const [row] = await db.select().from(backupSnapshots).where(and(eq(backupSnapshots.userId, userId), eq(backupSnapshots.id, id))); if (!row) throw new Error('备份不存在'); return row }

function hydrateBackupRow(row: unknown) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (['createdAt', 'updatedAt', 'expiresAt', 'lockedUntil', 'lastLoginAt', 'accessTokenExpiresAt', 'refreshTokenExpiresAt'].includes(key) && typeof value === 'string') {
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) throw new Error(`备份中的日期字段 ${key} 无效`)
      return [key, parsed]
    }
    return [key, value]
  }))
}

export async function restoreBackup(userId: string, rawPayload: unknown, actor?: { actorId: string; actorName: string }) {
  const payload = validateBackup(rawPayload, userId)
  await saveCloudSnapshot(userId, 'pre-restore')
  const deletionOrder = [smsDeliveryLogs, rentalOperations, notificationPolicies, paymentAllocations, paymentDiscounts, accountLedger, paymentRecords, receivableBills, rentalEvents, returnRecords, lossRecords, buyoutRecords, renewalAdjustments, renewalRecords, contractSnapshots, customerPortals, rentalItems, rentals, businessSettings] as const
  await db.transaction(async (tx) => {
    for (const table of deletionOrder) await tx.delete(table).where(eq(table.userId, userId))
    for (const [name, table] of Object.entries(backupTables)) {
      const rows = payload.tables[name]
      if (rows.length) await tx.insert(table).values(rows.map(hydrateBackupRow) as never)
    }
  })
  const result = { recordCount: countBackupRecords(payload), checksum: backupChecksum(payload) }
  if (actor) {
    await writeAuditLog({ userId, actorId: actor.actorId, actorName: actor.actorName }, {
      action: '恢复数据',
      resourceType: '数据备份',
      summary: `从 ${payload.createdAt} 生成的备份恢复数据，共 ${result.recordCount} 条记录`,
      metadata: { backupCreatedAt: payload.createdAt, schemaVersion: payload.schemaVersion, recordCount: result.recordCount, checksum: result.checksum },
    })
  }
  return result
}
