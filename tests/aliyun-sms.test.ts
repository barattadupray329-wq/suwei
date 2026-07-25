import { describe, expect, it } from 'vitest'
import { buildAliyunCanonicalQuery, getAliyunSmsErrorMessage } from '../lib/aliyun-sms'

describe('buildAliyunCanonicalQuery', () => {
  it('严格按 ASCII 字典序排列 SignName 与 Signature 参数', () => {
    expect(buildAliyunCanonicalQuery({
      SignatureVersion: '1.0',
      SignatureMethod: 'HMAC-SHA1',
      SignName: '速维电脑',
      Action: 'SendSms',
    })).toBe('Action=SendSms&SignName=%E9%80%9F%E7%BB%B4%E7%94%B5%E8%84%91&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0')
  })

  it('符合阿里云官方固定参数示例的规范化顺序', () => {
    expect(buildAliyunCanonicalQuery({
      Version: '2014-05-26',
      Timestamp: '2023-03-13T08:34:30Z',
      SignatureVersion: '1.0',
      SignatureNonce: 'edb2b34af0af9a6d14deaf7c1a5315eb',
      SignatureMethod: 'HMAC-SHA1',
      RegionId: 'cn-beijing',
      Format: 'JSON',
      Action: 'DescribeDedicatedHosts',
      AccessKeyId: 'testid',
    })).toBe('AccessKeyId=testid&Action=DescribeDedicatedHosts&Format=JSON&RegionId=cn-beijing&SignatureMethod=HMAC-SHA1&SignatureNonce=edb2b34af0af9a6d14deaf7c1a5315eb&SignatureVersion=1.0&Timestamp=2023-03-13T08%3A34%3A30Z&Version=2014-05-26')
  })
})

describe('getAliyunSmsErrorMessage', () => {
  it('将请求签名不匹配转换为可操作的中文提示', () => {
    expect(getAliyunSmsErrorMessage('SignatureDoesNotMatch', 'signature mismatch')).toContain('接口签名')
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
