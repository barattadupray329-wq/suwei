import { describe, expect, it } from 'vitest'
import { getAliyunSmsErrorMessage } from '../lib/aliyun-sms'

describe('getAliyunSmsErrorMessage', () => {
  it('将密钥签名不匹配转换为可操作的中文提示', () => {
    expect(getAliyunSmsErrorMessage('SignatureDoesNotMatch', 'signature mismatch')).toContain('更新阿里云 AccessKey')
  })

  it('将常见业务错误转换为具体提示', () => {
    expect(getAliyunSmsErrorMessage('isv.BUSINESS_LIMIT_CONTROL')).toBe('短信发送过于频繁，请稍后重试')
    expect(getAliyunSmsErrorMessage('isv.MOBILE_NUMBER_ILLEGAL')).toContain('手机号格式不正确')
    expect(getAliyunSmsErrorMessage('isv.SMS_TEMPLATE_ILLEGAL')).toContain('模板不可用')
  })

  it('未知错误优先展示供应商返回的信息', () => {
    expect(getAliyunSmsErrorMessage('UnknownError', '账户余额不足')).toBe('短信发送失败：账户余额不足')
  })

  it('供应商未返回错误码时给出安全重试提示', () => {
    expect(getAliyunSmsErrorMessage()).toBe('短信服务未返回明确结果，请稍后重试')
  })
})
