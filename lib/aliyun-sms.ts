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

const ALIYUN_SMS_ERROR_MESSAGES: Record<string, string> = {
  SignatureDoesNotMatch: '短信服务密钥校验失败，请联系管理员更新阿里云 AccessKey 后重试',
  InvalidAccessKeyIdNotFound: '短信服务 AccessKey 已失效或不存在，请联系管理员更新配置',
  isv: '短信服务商拒绝了本次发送，请检查短信签名、模板和接收号码',
  'isv.BUSINESS_LIMIT_CONTROL': '短信发送过于频繁，请稍后重试',
  'isv.MOBILE_NUMBER_ILLEGAL': '客户手机号格式不正确，请修改后重试',
  'isv.TEMPLATE_MISSING_PARAMETERS': '短信模板参数不完整，请联系管理员检查模板配置',
  'isv.TEMPLATE_PARAMS_ILLEGAL': '短信模板参数不符合要求，请联系管理员检查模板配置',
  'isv.SMS_SIGNATURE_ILLEGAL': '短信签名不可用，请联系管理员检查阿里云短信签名',
  'isv.SMS_TEMPLATE_ILLEGAL': '短信模板不可用，请联系管理员检查模板审核状态',
}

export function getAliyunSmsErrorMessage(code?: string, providerMessage?: string) {
  if (!code) return '短信服务未返回明确结果，请稍后重试'
  const exact = ALIYUN_SMS_ERROR_MESSAGES[code]
  if (exact) return exact
  if (code.startsWith('isv.')) return ALIYUN_SMS_ERROR_MESSAGES.isv
  return providerMessage ? `短信发送失败：${providerMessage}` : `短信发送失败（错误码：${code}）`
}

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
