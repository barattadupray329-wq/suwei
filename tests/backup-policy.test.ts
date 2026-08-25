import { describe, expect, it } from 'vitest'
import { computeDailySnapshotsToPrune, MAX_CLOUD_SNAPSHOTS, shanghaiDateKey } from '../lib/backup-policy'

describe('自动备份策略', () => {
  it('固定保留最近 7 次云端备份（历史常量，兼容旧引用）', () => {
    expect(MAX_CLOUD_SNAPSHOTS).toBe(7)
  })

  it('按上海时区判断每天首次开启', () => {
    expect(shanghaiDateKey(new Date('2026-07-21T15:59:59.000Z'))).toBe('2026-07-21')
    expect(shanghaiDateKey(new Date('2026-07-21T16:00:00.000Z'))).toBe('2026-07-22')
  })
})

describe('每日快照分层保留策略', () => {
  const now = new Date('2026-08-25T04:00:00.000Z') // 上海时间 2026-08-25 12:00

  function dayKey(daysAgo: number) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - daysAgo)
    return shanghaiDateKey(d)
  }

  it('近14天全部保留', () => {
    const snapshots = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, dateKey: dayKey(i) }))
    expect(computeDailySnapshotsToPrune(snapshots, now)).toEqual([])
  })

  it('15~90天每周只保留最早一份，其余清理', () => {
    // 构造第 15~28 天（两周）的每日快照
    const snapshots = Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, dateKey: dayKey(15 + i) }))
    const pruned = computeDailySnapshotsToPrune(snapshots, now)
    // 两周共保留 2 份，其余 12 份应被清理
    expect(pruned.length).toBe(12)
  })

  it('91~365天每月只保留最早一份，其余清理', () => {
    const snapshots = Array.from({ length: 30 }, (_, i) => ({ id: 200 + i, dateKey: dayKey(91 + i) }))
    const pruned = computeDailySnapshotsToPrune(snapshots, now)
    // 30 天跨 1~2 个自然月，至少保留 1 份，其余应被清理
    expect(pruned.length).toBeGreaterThanOrEqual(28)
    expect(snapshots.length - pruned.length).toBeLessThanOrEqual(2)
  })

  it('超过365天的快照全部清理', () => {
    const snapshots = [{ id: 999, dateKey: dayKey(400) }]
    expect(computeDailySnapshotsToPrune(snapshots, now)).toEqual([999])
  })

  it('保留每个分组中最早的一份而不是最新的一份', () => {
    // 同一周内两份，应保留 dateKey 更小（更早）的那份
    const weekAgoStart = 20
    const snapshots = [
      { id: 1, dateKey: dayKey(weekAgoStart) },
      { id: 2, dateKey: dayKey(weekAgoStart + 1) },
    ]
    const pruned = computeDailySnapshotsToPrune(snapshots, now)
    expect(pruned.length).toBe(1)
    // 较晚（更接近今天，即 dayKey 更大）的那个 id=1 应该被清理，保留更早的 id=2
    expect(pruned).toEqual([1])
  })
})
