export function extractCustomerName(question: string) {
  const normalized = question.replace(/[，。！？,.!?]/g, ' ').trim()
  const patterns = [
    /(?:发送给|发给|提醒|通知)([\u4e00-\u9fa5·]{2,8}?)(?:的|租|到期|短信|\s|$)/,
    /([\u4e00-\u9fa5·]{2,8}?)(?:租了|租的|名下|有几|有多少|的合同|的设备|到期)/,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export function resolveCustomerName(question: string, history: Array<{ role: string; content: string }> = []) {
  const usesContextReference = /(?:他|她|这个客户|该客户)/.test(question)
  const direct = usesContextReference ? null : extractCustomerName(question)
  if (direct) return direct
  if (!/(?:他|她|这个客户|该客户|到期|合同|设备|几台|多少台)/.test(question)) return null
  for (const message of [...history].reverse()) {
    const contextual = extractCustomerName(message.content)
    if (contextual) return contextual
  }
  return null
}

export function wantsCustomerDueStatus(question: string) {
  return /(?:到期|逾期)/.test(question) && /(?:他|她|客户|有几|多少|几台|设备|订单|合同)/.test(question)
}

export function wantsDueSms(question: string) {
  return /(?:发送|发一?条|发给|短信|通知)/.test(question) && /(?:到期|租到)/.test(question)
}

export type XiaoweiIntent = 'capabilities' | 'greeting' | 'customer' | 'customer-due' | 'due-sms' | 'business' | 'chat'

export function classifyXiaoweiIntent(question: string, hasCustomerContext = false): XiaoweiIntent {
  const text = question.trim()
  if (/^(?:你好|您好|嗨|哈喽|在吗|小维)[！!？?。.\s]*$/.test(text)) return 'greeting'
  if (/(?:你会什么|你会哪些|能做什么|有什么功能|怎么用|如何使用|介绍一下你自己|你是谁)/.test(text)) return 'capabilities'
  if (wantsDueSms(text)) return 'due-sms'
  if (wantsCustomerDueStatus(text) && (hasCustomerContext || Boolean(extractCustomerName(text)))) return 'customer-due'
  if (/(?:租了|租的|名下|的合同|的设备|几台|多少台)/.test(text) && (hasCustomerContext || Boolean(extractCustomerName(text)))) return 'customer'
  if (/(?:经营|分析|数据|待收|应收|逾期|收款|收入|合同总数|设备总数|本月|今日建议|风险|关注)/.test(text)) return 'business'
  return 'chat'
}
