import { describe, expect, it } from 'vitest'
import { canAutoUpdate, shortVersion, UPDATE_IDLE_MS } from '../lib/version-update'

const safe = {
  idleFor: UPDATE_IDLE_MS,
  dirty: false,
  dialogOpen: false,
  inputFocused: false,
  submitting: false,
  visible: true,
}

describe('版本安全更新判断', () => {
  it('仅在页面可见且操作员空闲时允许自动更新', () => {
    expect(canAutoUpdate(safe)).toBe(true)
    expect(canAutoUpdate({ ...safe, idleFor: UPDATE_IDLE_MS - 1 })).toBe(false)
    expect(canAutoUpdate({ ...safe, visible: false })).toBe(false)
  })

  it('编辑、弹窗、输入焦点和提交状态均阻止自动刷新', () => {
    expect(canAutoUpdate({ ...safe, dirty: true })).toBe(false)
    expect(canAutoUpdate({ ...safe, dialogOpen: true })).toBe(false)
    expect(canAutoUpdate({ ...safe, inputFocused: true })).toBe(false)
    expect(canAutoUpdate({ ...safe, submitting: true })).toBe(false)
  })

  it('版本号展示不会占用过多空间', () => {
    expect(shortVersion('202607281530-abcdefg')).toBe('202607281530-abcdefg')
    expect(shortVersion('123456789012345678901234567890')).toHaveLength(24)
  })
})
