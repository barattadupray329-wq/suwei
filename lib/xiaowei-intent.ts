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

export function wantsDueSms(question: string) {
  return /(?:发送|发一?条|发给|短信|通知)/.test(question) && /(?:到期|租到)/.test(question)
}
