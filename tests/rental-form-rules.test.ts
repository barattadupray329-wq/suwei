import { describe, expect, it } from 'vitest'
import { normalizeDeviceName, normalizeStartDateReason, validateRentalItemFields } from '../lib/rental-form-rules'

const now = new Date('2026-07-24T04:00:00.000Z')

describe('起租日期原因', () => {
  it('北京时间当天不保存原因', () => {
    expect(normalizeStartDateReason('2026-07-24', '补录', now)).toBeNull()
  })

  it.each(['旧数据转移', '客户要求', '补录'])('非当天允许原因：%s', (reason) => {
    expect(normalizeStartDateReason('2026-07-23', reason, now)).toBe(reason)
    expect(normalizeStartDateReason('2026-07-25', reason, now)).toBe(reason)
  })

  it('非当天缺少原因时拒绝', () => {
    expect(() => normalizeStartDateReason('2026-07-25', '', now)).toThrow('非当天起租必须选择原因')
  })
})

describe('设备字段规则', () => {
  it('台式机使用兼容名称且不要求输入名称', () => {
    expect(normalizeDeviceName('台式机', '')).toBe('台式机')
    expect(validateRentalItemFields({ deviceType: '台式机', deviceName: '', quantity: 1, monthlyRent: 100 })).toBe('')
  })

  it('显示器仅要求品牌和尺寸', () => {
    expect(validateRentalItemFields({ deviceType: '显示器', deviceName: 'AOC', screenSize: '27 英寸', quantity: 1, monthlyRent: 50 })).toBe('')
    expect(validateRentalItemFields({ deviceType: '显示器', deviceName: 'AOC', screenSize: '', quantity: 1, monthlyRent: 50 })).toBe('显示器必须填写品牌和屏幕尺寸')
  })
})
