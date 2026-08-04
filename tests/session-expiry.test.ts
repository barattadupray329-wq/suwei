import { describe, expect, it } from 'vitest'
import { isAuthExpiredMessage } from '../lib/session-expiry'

describe('会话失效识别', () => {
  it.each(['未登录', '登录状态已失效，请重新登录', 'Unauthorized', 'not authenticated', 'invalid session'])(
    '识别需要重新登录的错误：%s',
    (message) => expect(isAuthExpiredMessage(message)).toBe(true),
  )

  it('支持 Error 对象', () => expect(isAuthExpiredMessage(new Error('未登录'))).toBe(true))

  it.each(['没有该模块的操作权限', '网络连接失败，请检查网络后重试', '日期格式无效', '', null])(
    '不误判其他错误：%s',
    (message) => expect(isAuthExpiredMessage(message)).toBe(false),
  )
})
