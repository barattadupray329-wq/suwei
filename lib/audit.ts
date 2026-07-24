import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

export type AuditContext = { userId: string; actorId: string; actorName: string }

export async function writeAuditLog(context: AuditContext, entry: { action: string; resourceType: string; resourceId?: string | number; summary: string; metadata?: Record<string, unknown> }) {
  await db.insert(auditLogs).values({
    userId: context.userId,
    actorUserId: context.actorId,
    actorName: context.actorName,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId === undefined ? null : String(entry.resourceId),
    summary: entry.summary,
    metadata: entry.metadata ?? {},
  })
}

export async function listAuditLogs(userId: string, page = 1, pageSize = 20) {
  const safePage = Math.max(1, Math.min(500000, Math.trunc(page)))
  const safeSize = Math.max(1, Math.min(100, Math.trunc(pageSize)))
  const [[countRow], rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(eq(auditLogs.userId, userId)),
    db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(safeSize).offset((safePage - 1) * safeSize),
  ])
  const total = Number(countRow?.count ?? 0)
  return { rows, total, page: safePage, pageCount: Math.max(1, Math.ceil(total / safeSize)) }
}
