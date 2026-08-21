import { describe, expect, it } from 'vitest'
import { classifyXiaoweiIntent, extractCustomerName, resolveCustomerName, wantsCustomerDueStatus } from '../lib/xiaowei-intent'

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

  it('能力询问和闲聊不会误判为客户查询', () => {
    expect(extractCustomerName('你会哪些')).toBeNull()
    expect(classifyXiaoweiIntent('你会哪些')).toBe('capabilities')
    expect(classifyXiaoweiIntent('你好')).toBe('greeting')
    expect(classifyXiaoweiIntent('今天天气不错')).toBe('chat')
  })

  it('明确业务问题进入对应路由', () => {
    expect(classifyXiaoweiIntent('陈江涛租了几台')).toBe('customer')
    expect(classifyXiaoweiIntent('他到期的有几台', true)).toBe('customer-due')
    expect(classifyXiaoweiIntent('发送给郑智铭到期通知')).toBe('due-sms')
    expect(classifyXiaoweiIntent('当前逾期待收情况怎么样？')).toBe('business')
  })
})
