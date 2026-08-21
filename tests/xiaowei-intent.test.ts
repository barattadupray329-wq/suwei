import { describe, expect, it } from 'vitest'
import { extractCustomerName, resolveCustomerName, wantsCustomerDueStatus } from '../lib/xiaowei-intent'

describe('小维客户意图识别', () => {
  it('识别客户设备数量查询', () => {
    expect(extractCustomerName('陈立涛租了几台')).toBe('陈立涛')
    expect(extractCustomerName('郑智铭名下有多少设备？')).toBe('郑智铭')
  })

  it('识别到期短信指令', () => {
    expect(extractCustomerName('发送给郑智铭到期通知')).toBe('郑智铭')
    expect(extractCustomerName('发给郑智铭 租到通知')).toBe('郑智铭')
  })

  it('沿用上一轮客户理解代词追问', () => {
    const history = [
      { role: 'user', content: '陈江涛租了几台' },
      { role: 'assistant', content: '陈江涛当前有 6 份有效合同，共租用 21 台设备。' },
    ]
    expect(resolveCustomerName('他到期的有几台', history)).toBe('陈江涛')
    expect(wantsCustomerDueStatus('他到期的有几台')).toBe(true)
  })

  it('不从普通经营问题中猜测客户', () => {
    expect(extractCustomerName('当前逾期待收情况怎么样？')).toBeNull()
    expect(resolveCustomerName('当前逾期待收情况怎么样？', [{ role: 'user', content: '陈江涛租了几台' }])).toBeNull()
  })
})
