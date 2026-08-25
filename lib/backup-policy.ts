// 历史上固定只保留最近 7 次每日云端快照。为兼容旧引用保留此常量，
// 但每日快照的实际清理已改为下方的分层保留策略（daily/weekly/monthly）。
export const MAX_CLOUD_SNAPSHOTS = 7
// 手动备份与恢复前保护点各自独立的数量上限，避免关键快照被过快清理掉。
export const MAX_MANUAL_SNAPSHOTS = 20
export const MAX_PRE_RESTORE_SNAPSHOTS = 10
export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'

export function shanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export type DailySnapshotInfo = { id: number; dateKey: string }

/**
 * 每日快照分层保留策略：
 * - 最近 14 天：全部保留
 * - 15~90 天：每自然周只保留 1 份（保留该周内最早的一份，即周一或首次备份当天）
 * - 91~365 天：每自然月只保留 1 份（保留当月最早的一份）
 * - 超过 365 天：不再保留
 *
 * 输入需按 dateKey 降序排列（最新的在前）。返回应当删除的快照 id 列表。
 */
export function computeDailySnapshotsToPrune(snapshots: DailySnapshotInfo[], now = new Date()): number[] {
  const todayKey = shanghaiDateKey(now)
  const today = new Date(`${todayKey}T00:00:00+08:00`)
  const toPrune: number[] = []
  const keptWeekKeys = new Set<string>()
  const keptMonthKeys = new Set<string>()

  // 按 dateKey 升序处理，使每个分组保留"最早"的一份
  const sorted = [...snapshots].sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))

  for (const snap of sorted) {
    const snapDate = new Date(`${snap.dateKey}T00:00:00+08:00`)
    const ageDays = Math.round((today.getTime() - snapDate.getTime()) / 86400000)

    if (ageDays <= 14) continue // 近14天全部保留
    if (ageDays > 365) {
      toPrune.push(snap.id)
      continue
    }
    if (ageDays <= 90) {
      const weekKey = isoWeekKey(snapDate)
      if (keptWeekKeys.has(weekKey)) toPrune.push(snap.id)
      else keptWeekKeys.add(weekKey)
      continue
    }
    const monthKey = snap.dateKey.slice(0, 7)
    if (keptMonthKeys.has(monthKey)) toPrune.push(snap.id)
    else keptMonthKeys.add(monthKey)
  }

  return toPrune
}

function isoWeekKey(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
