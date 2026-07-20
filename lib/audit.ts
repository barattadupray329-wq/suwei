import { desc, eq } from 'drizzle-orm'
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

export async function listAuditLogs(userId: string, limit = 100) {
  return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(Math.min(200, Math.max(1, limit)))
}
