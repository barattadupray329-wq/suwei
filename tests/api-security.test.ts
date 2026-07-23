import { describe, expect, it } from 'vitest'
import { ApiRequestError, parseJson, passwordLoginSchema, phoneCodeSchema, phoneSchema } from '../lib/api-security'

function jsonRequest(body: string, headers: HeadersInit = {}) {
  return new Request('https://www.tuzhuzu.cn/api/test', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } })
}

describe('API 请求安全', () => {
  it('校验手机号和验证码', async () => {
    await expect(parseJson(jsonRequest('{"phone":"13800138000","code":"123456"}'), phoneCodeSchema)).resolves.toEqual({ phone: '13800138000', code: '123456' })
    await expect(parseJson(jsonRequest('{"phone":"123"}'), phoneSchema)).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('拒绝未知字段和非法 JSON', async () => {
    await expect(parseJson(jsonRequest('{"phone":"13800138000","extra":true}'), phoneSchema)).rejects.toBeInstanceOf(ApiRequestError)
    await expect(parseJson(jsonRequest('{'), phoneSchema)).rejects.toMatchObject({ status: 400 })
  })

  it('限制请求体大小', async () => {
    await expect(parseJson(jsonRequest('{}', { 'content-length': '20000' }), phoneSchema)).rejects.toMatchObject({ status: 413 })
  })

  it('允许受控接口配置更大的请求体上限', async () => {
    const request = jsonRequest('{"phone":"13800138000"}', { 'content-length': '20000' })
    await expect(parseJson(request, phoneSchema, 30000)).resolves.toEqual({ phone: '13800138000' })
  })

  it('规范化登录账号并限制密码', async () => {
    await expect(parseJson(jsonRequest('{"identity":" Admin ","password":"password123"}'), passwordLoginSchema)).resolves.toEqual({ identity: 'admin', password: 'password123' })
  })
})
