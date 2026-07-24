import { createHmac, randomUUID } from 'node:crypto'

type SendAliyunSmsInput = {
  accessKeyId: string
  accessKeySecret: string
  phone: string
  signName: string
  templateCode: string
  templateParams: Record<string, string>
}

type AliyunSmsResponse = {
  Code?: string
  Message?: string
  RequestId?: string
}

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)

export async function sendAliyunSms(input: SendAliyunSmsInput) {
  const parameters: Record<string, string> = {
    AccessKeyId: input.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: input.phone,
    RegionId: 'cn-hangzhou',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    SignName: input.signName,
    TemplateCode: input.templateCode,
    TemplateParam: JSON.stringify(input.templateParams),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  }
  const canonical = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&')
  const signature = createHmac('sha1', `${input.accessKeySecret}&`).update(`POST&${encode('/')}&${encode(canonical)}`).digest('base64')
  const body = new URLSearchParams({ ...parameters, Signature: signature })
  const response = await fetch('https://dysmsapi.aliyuncs.com/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body, signal: AbortSignal.timeout(10_000) })
  const result = await response.json() as AliyunSmsResponse
  return { code: result.Code, message: result.Message, requestId: result.RequestId }
}
