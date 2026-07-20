import { describe, expect, it } from 'vitest'
import { MAX_CLOUD_SNAPSHOTS, shanghaiDateKey } from '../lib/backup-policy'

describe('自动备份策略', () => {
  it('固定保留最近 7 次云端备份', () => {
    expect(MAX_CLOUD_SNAPSHOTS).toBe(7)
  })

  it('按上海时区判断每天首次开启', () => {
    expect(shanghaiDateKey(new Date('2026-07-21T15:59:59.000Z'))).toBe('2026-07-21')
    expect(shanghaiDateKey(new Date('2026-07-21T16:00:00.000Z'))).toBe('2026-07-22')
  })
})
