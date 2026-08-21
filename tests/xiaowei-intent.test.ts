import { describe, expect, it } from 'vitest'
import { extractCustomerName } from '../lib/xiaowei-intent'

describe('小维客户意图识别', () => {
  it('识别客户设备数量查询', () => {
    expect(extractCustomerName('陈立涛租了几台')).toBe('陈立涛')
    expect(extractCustomerName('郑智铭名下有多少设备？')).toBe('郑智铭')
  })

  it('识别到期短信指令', () => {
    expect(extractCustomerName('发送给郑智铭到期通知')).toBe('郑智铭')
    expect(extractCustomerName('发给郑智铭 租到通知')).toBe('郑智铭')
  })

  it('不从普通经营问题中猜测客户', () => {
    expect(extractCustomerName('当前逾期待收情况怎么样？')).toBeNull()
  })
})
