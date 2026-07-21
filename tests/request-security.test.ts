import { describe, expect, it } from 'vitest'
import { contentLengthExceeds, isTrustedMutationRequest } from '../lib/request-security'

function request(headers: HeadersInit = {}) {
  return new Request('https://www.tuzhuzu.cn/api/customer-auth/request', {
    method: 'POST',
    headers,
  })
}

describe('敏感请求来源保护', () => {
  it('允许同源浏览器请求', () => {
    expect(isTrustedMutationRequest(request({ origin: 'https://www.tuzhuzu.cn', 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  it('拒绝跨站浏览器请求', () => {
    expect(isTrustedMutationRequest(request({ origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })

  it('支持 Vercel 转发后的同源判断', () => {
    expect(isTrustedMutationRequest(request({
      origin: 'https://www.tuzhuzu.cn',
      'x-forwarded-host': 'www.tuzhuzu.cn',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    }))).toBe(true)
  })

  it('拒绝超过限制的请求体', () => {
    expect(contentLengthExceeds(request({ 'content-length': '10485761' }), 10 * 1024 * 1024)).toBe(true)
    expect(contentLengthExceeds(request({ 'content-length': '1024' }), 10 * 1024 * 1024)).toBe(false)
  })
})
