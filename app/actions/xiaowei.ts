'use server'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { businessSmsReadiness, sendBusinessSms } from '@/lib/business-sms'
import { maskCustomerPhone } from '@/lib/customer-phone-auth'
import { db } from '@/lib/db'
import { classifyXiaoweiIntent, resolveCustomerName } from '@/lib/xiaowei-intent'
import { aiUsageDaily, auditLogs, paymentRecords, receivableBills, rentalEvents, rentalItems, rentals } from '@/lib/db/schema'
import { beijingDate, hasRemainingRentalItems } from '@/lib/sms-reminder-rules'

export type XiaoweiMessage = { role: 'user' | 'assistant'; content: string }
export type XiaoweiSmsPreview = {
  token: string
  customerName: string
  maskedPhone: string
  expiresAt: string
  contracts: Array<{ id: number; contractNo: string; endDate: string; remainingQuantity: number; overdue: boolean }>
}
export type XiaoweiAnswer = {
  title: string
  summary: string
  facts: string[]
  scope: string
  updatedAt: string
  href: string
  hrefLabel: string
  suggestions: string[]
  remainingRequests: number
  aiGenerated: boolean
  smsPreview?: XiaoweiSmsPreview
}
export type XiaoweiSmsResult = { ok: boolean; summary: string; details: string[] }

const MODEL = '@cf/meta/llama-3.2-1b-instruct'
const DAILY_NEURON_BUDGET = 9000
const RESERVED_NEURONS_PER_REQUEST = 450
const MAX_HISTORY = 6
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const chinaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const nowText = () => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date())
const ACTIVE_STATUSES = ['在租', '即将到期', '部分买断', '部分退租']
const SMS_CONFIRM_TTL_MS = 5 * 60 * 1000

type SmsTokenPayload = { userId: string; customerName: string; phone: string; rentalIds: number[]; expiresAt: number }

function signSmsPayload(payload: SmsTokenPayload) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('短信确认服务暂不可用')
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifySmsPayload(token: string): SmsTokenPayload {
  const secret = process.env.BETTER_AUTH_SECRET
  const [encoded, signature] = token.split('.')
  if (!secret || !encoded || !signature) throw new Error('短信确认已失效，请重新发起')
  const expected = createHmac('sha256', secret).update(encoded).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('短信确认信息无效，请重新发起')
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SmsTokenPayload
  if (payload.expiresAt < Date.now()) throw new Error('短信确认已过期，请重新发起')
  return payload
}

function aiUnavailable(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (/3036|account limited|quota|limit|429/i.test(message)) throw new Error('今日 AI 免费额度已用完，请明日再试')
  throw new Error('小维 AI 暂时不可用，请稍后再试')
}

async function reserveFreeUsage(userId: string) {
  const date = chinaDate()
  const [usage] = await db.select({ neurons: sql<number>`coalesce(sum(${aiUsageDaily.estimatedNeurons}), 0)` }).from(aiUsageDaily).where(eq(aiUsageDaily.usageDate, date))
  const used = Number(usage?.neurons || 0)
  if (used + RESERVED_NEURONS_PER_REQUEST > DAILY_NEURON_BUDGET) throw new Error('今日 AI 免费额度已用完，请明日再试')
  await db.insert(aiUsageDaily).values({ userId, usageDate: date, requests: 1, estimatedNeurons: RESERVED_NEURONS_PER_REQUEST }).onConflictDoUpdate({
    target: [aiUsageDaily.userId, aiUsageDaily.usageDate],
    set: { requests: sql`${aiUsageDaily.requests} + 1`, estimatedNeurons: sql`${aiUsageDaily.estimatedNeurons} + ${RESERVED_NEURONS_PER_REQUEST}`, updatedAt: new Date() },
  })
  return Math.max(0, Math.floor((DAILY_NEURON_BUDGET - used - RESERVED_NEURONS_PER_REQUEST) / RESERVED_NEURONS_PER_REQUEST))
}

async function getBusinessContext(userId: string) {
  const today = chinaDate()
  const month = today.slice(0, 7)
  const [[active], [due], [overdue], [paid], events] = await Promise.all([
    db.select({ contracts: sql<number>`count(*)`, quantity: sql<number>`coalesce(sum(${rentals.quantity}), 0)`, rent: sql<number>`coalesce(sum(cast(${rentals.totalRent} as real)), 0)` }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.lifecycleStatus, 'active'), sql`${rentals.quantity} > 0`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${receivableBills.amount} as real) - cast(${receivableBills.paidAmount} as real)), 0)` }).from(receivableBills).where(and(eq(receivableBills.userId, userId), sql`cast(${receivableBills.amount} as real) > cast(${receivableBills.paidAmount} as real)`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${receivableBills.amount} as real) - cast(${receivableBills.paidAmount} as real)), 0)` }).from(receivableBills).where(and(eq(receivableBills.userId, userId), sql`cast(${receivableBills.amount} as real) > cast(${receivableBills.paidAmount} as real)`, sql`${receivableBills.dueDate} < ${today}`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${paymentRecords.amount} as real)), 0)` }).from(paymentRecords).where(and(eq(paymentRecords.userId, userId), sql`substr(${paymentRecords.paymentDate}, 1, 7) = ${month}`)),
    db.select({ type: rentalEvents.eventType, count: sql<number>`count(*)` }).from(rentalEvents).where(and(eq(rentalEvents.userId, userId), sql`substr(${rentalEvents.eventDate}, 1, 7) = ${month}`)).groupBy(rentalEvents.eventType),
  ])
  const facts = [
    `在租合同：${Number(active?.contracts || 0)}份；在租设备：${Number(active?.quantity || 0)}台；合同金额合计：${money(Number(active?.rent || 0))}`,
    `当前待收：${money(Number(due?.amount || 0))}（${Number(due?.count || 0)}笔）`,
    `逾期待收：${money(Number(overdue?.amount || 0))}（${Number(overdue?.count || 0)}笔）`,
    `本月实际收款：${money(Number(paid?.amount || 0))}（${Number(paid?.count || 0)}笔，包含冲正负数）`,
    `本月业务：${events.length ? events.map((item) => `${item.type}${item.count}次`).join('、') : '暂无记录'}`,
  ]
  return { facts, today, month }
}

async function getCustomerContracts(userId: string, customerName: string) {
  return db.select({
    id: rentals.id,
    contractNo: rentals.contractNo,
    customerName: rentals.customerName,
    customerPhone: rentals.customerPhone,
    quantity: rentals.quantity,
    endDate: rentals.endDate,
    status: rentals.status,
  }).from(rentals).where(and(
    eq(rentals.userId, userId),
    eq(rentals.customerName, customerName),
    eq(rentals.orderType, 'official'),
    eq(rentals.lifecycleStatus, 'active'),
  )).limit(30)
}

async function customerAnswer(userId: string, customerName: string, remainingRequests: number): Promise<XiaoweiAnswer | null> {
  const contracts = await getCustomerContracts(userId, customerName)
  if (!contracts.length) return null
  const quantity = contracts.reduce((sum, contract) => sum + Math.max(0, Number(contract.quantity || 0)), 0)
  return {
    title: `${customerName}的租赁情况`,
    summary: `${customerName}当前有 ${contracts.length} 份有效合同，共租用 ${quantity} 台设备。`,
    facts: contracts.map((contract) => `${contract.contractNo}｜${contract.quantity}台｜${contract.status}｜到期 ${contract.endDate}`),
    scope: '按当前店铺中的客户姓名精确查询，仅展示有效正式合同',
    updatedAt: nowText(), href: `/rentals?query=${encodeURIComponent(customerName)}`, hrefLabel: '查看客户合同',
    suggestions: [`${customerName}有哪些合同？`, `${customerName}有没有到期订单？`, `发送给${customerName}到期通知`],
    remainingRequests, aiGenerated: false,
  }
}

async function customerDueAnswer(userId: string, customerName: string, remainingRequests: number): Promise<XiaoweiAnswer | null> {
  const contracts = await getCustomerContracts(userId, customerName)
  if (!contracts.length) return null
  const today = beijingDate()
  const dueContracts = contracts.filter((contract) => contract.endDate <= today)
  const items = dueContracts.length ? await db.select({
    rentalId: rentalItems.rentalId,
    quantity: rentalItems.quantity,
    boughtOutQuantity: rentalItems.boughtOutQuantity,
    returnedQuantity: rentalItems.returnedQuantity,
    lostQuantity: rentalItems.lostQuantity,
  }).from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, dueContracts.map((contract) => contract.id)))) : []
  const due = dueContracts.map((contract) => ({
    ...contract,
    remainingQuantity: items.filter((item) => item.rentalId === contract.id).reduce((sum, item) => sum + Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity), 0),
  })).filter((contract) => contract.remainingQuantity > 0)
  const quantity = due.reduce((sum, contract) => sum + contract.remainingQuantity, 0)
  return {
    title: `${customerName}的到期情况`,
    summary: due.length ? `${customerName}当前有 ${due.length} 份已到期且仍未归还的合同，共 ${quantity} 台设备。` : `${customerName}当前没有已到期且仍未归还的设备。`,
    facts: due.length ? due.map((contract) => `${contract.contractNo}｜未归还 ${contract.remainingQuantity} 台｜${contract.endDate} 到期`) : ['未发现结束日期不晚于今天且仍有未归还设备的有效正式合同'],
    scope: '沿用上一轮客户，仅统计当前店铺内已到期且仍有未归还设备的有效正式合同',
    updatedAt: nowText(), href: `/rentals?query=${encodeURIComponent(customerName)}`, hrefLabel: '查看客户合同',
    suggestions: [`${customerName}有哪些合同？`, `发送给${customerName}到期通知`], remainingRequests, aiGenerated: false,
  }
}

async function prepareDueSms(userId: string, customerName: string, remainingRequests: number): Promise<XiaoweiAnswer> {
  const contracts = await getCustomerContracts(userId, customerName)
  if (!contracts.length) throw new Error(`当前店铺未找到客户“${customerName}”的有效合同`)
  const contacts = [...new Set(contracts.map((contract) => contract.customerPhone).filter(Boolean))]
  if (contacts.length !== 1) throw new Error(contacts.length ? `客户“${customerName}”存在多个手机号，请先到租赁管理核对` : `客户“${customerName}”没有手机号，无法发送短信`)
  const today = beijingDate()
  const limitDate = beijingDate(3)
  const candidates = contracts.filter((contract) => contract.endDate >= '2000-01-01' && contract.endDate <= limitDate && ACTIVE_STATUSES.includes(contract.status))
  const items = candidates.length ? await db.select({ rentalId: rentalItems.rentalId, quantity: rentalItems.quantity, boughtOutQuantity: rentalItems.boughtOutQuantity, returnedQuantity: rentalItems.returnedQuantity, lostQuantity: rentalItems.lostQuantity }).from(rentalItems).where(and(eq(rentalItems.userId, userId), inArray(rentalItems.rentalId, candidates.map((item) => item.id)))) : []
  const eligible = candidates.map((contract) => {
    const contractItems = items.filter((item) => item.rentalId === contract.id)
    const remainingQuantity = contractItems.reduce((sum, item) => sum + Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity), 0)
    return { ...contract, remainingQuantity }
  }).filter((contract) => contract.remainingQuantity > 0 && hasRemainingRentalItems(items.filter((item) => item.rentalId === contract.id)))
  if (!eligible.length) throw new Error(`${customerName}没有已到期或未来 3 天内到期且仍有未归还设备的合同`)
  const expiresAt = Date.now() + SMS_CONFIRM_TTL_MS
  const token = signSmsPayload({ userId, customerName, phone: contacts[0], rentalIds: eligible.map((item) => item.id), expiresAt })
  return {
    title: '确认发送到期短信',
    summary: `找到 ${customerName} 的 ${eligible.length} 份到期合同。请核对后确认发送；系统会逐份合同发送，并自动防止当天重复扣费。`,
    facts: eligible.map((contract) => `${contract.contractNo}｜未归还 ${contract.remainingQuantity} 台｜${contract.endDate < today ? `已逾期（${contract.endDate}）` : `${contract.endDate} 到期`}`),
    scope: '这是短信发送预览；点击确认后才会调用阿里云短信服务', updatedAt: nowText(),
    href: `/rentals?query=${encodeURIComponent(customerName)}`, hrefLabel: '核对客户合同', suggestions: [], remainingRequests, aiGenerated: false,
    smsPreview: { token, customerName, maskedPhone: maskCustomerPhone(contacts[0]), expiresAt: new Date(expiresAt).toISOString(), contracts: eligible.map((contract) => ({ id: contract.id, contractNo: contract.contractNo, endDate: contract.endDate, remainingQuantity: contract.remainingQuantity, overdue: contract.endDate < today })) },
  }
}

export async function confirmXiaoweiDueSms(token: string): Promise<XiaoweiSmsResult> {
  const access = await getAccessContext('租赁操作')
  const payload = verifySmsPayload(token)
  if (payload.userId !== access.userId) throw new Error('无权发送该短信')
  const answer = await prepareDueSms(access.userId, payload.customerName, 0)
  const current = answer.smsPreview
  if (!current || current.maskedPhone !== maskCustomerPhone(payload.phone) || current.contracts.map((item) => item.id).sort().join(',') !== [...payload.rentalIds].sort().join(',')) throw new Error('合同状态已变化，请重新核对后发送')
  if (!businessSmsReadiness('due-reminder').configured) throw new Error('到期提醒短信模板尚未配置或审核通过')
  const details: string[] = []
  let sent = 0
  for (const contract of current.contracts) {
    const result = await sendBusinessSms({ userId: access.userId, rentalId: contract.id, phone: payload.phone, scene: 'due-reminder', triggerType: 'manual', actorUserId: access.actorId, idempotencyKey: `${access.userId}:${contract.id}:due-reminder:${beijingDate()}`, params: { customer: payload.customerName.slice(0, 20), dueDate: contract.endDate } })
    if (result.ok) sent += 1
    details.push(`${contract.contractNo}：${result.message}`)
    await db.insert(auditLogs).values({ userId: access.userId, actorUserId: access.actorId, actorName: access.actorName, action: '小维发送到期短信', resourceType: '租赁合同', resourceId: String(contract.id), summary: `${result.ok ? '成功' : '未发送'}发送到期提醒至 ${maskCustomerPhone(payload.phone)}`, metadata: { contractNo: contract.contractNo, result: result.ok ? 'success' : 'skipped_or_failed' } })
  }
  return { ok: sent > 0, summary: sent ? `已成功发送 ${sent} 条到期提醒短信` : '没有发送新短信，请查看各合同结果', details }
}

async function askXiaoweiInternal(question: string, history: XiaoweiMessage[] = []): Promise<XiaoweiAnswer> {
  const access = await getAccessContext('租赁操作')
  const text = question.trim()
  if (text.length < 2) throw new Error('请告诉小维你想查询什么')
  if (text.length > 300) throw new Error('问题请控制在 300 字以内')
  const customerName = resolveCustomerName(text, history)
  const intent = classifyXiaoweiIntent(text, Boolean(customerName))
  if (intent === 'capabilities') {
    return {
      title: '小维能帮你做这些事',
      summary: '我可以正常对话，也能结合当前店铺数据回答租赁业务问题。涉及短信时，我会先生成预览，只有你确认后才发送。',
      facts: ['查询指定客户的有效合同、在租设备和到期设备', '分析待收、逾期、收款和经营风险', '生成客户到期短信预览，并在二次确认后发送', '解释租赁业务流程，给出下一步处理建议'],
      scope: '业务查询默认只读；短信必须二次确认；不会直接收款、退租或修改合同',
      updatedAt: nowText(), href: '/rentals', hrefLabel: '查看租赁管理',
      suggestions: ['陈江涛租了几台？', '当前逾期待收情况怎么样？', '发送给郑智铭到期通知'], remainingRequests: 0, aiGenerated: false,
    }
  }
  if (intent === 'greeting') {
    return {
      title: '你好，我是小维', summary: '我在。你可以直接和我聊天，也可以问客户、合同、设备、待收和到期提醒。', facts: [],
      scope: '租赁业务助手', updatedAt: nowText(), href: '/rentals', hrefLabel: '查看租赁管理',
      suggestions: ['你会哪些？', '哪些数据最需要我关注？', '陈江涛租了几台？'], remainingRequests: 0, aiGenerated: false,
    }
  }
  if (intent === 'due-sms') {
    if (!customerName) throw new Error('请说清楚客户姓名，例如“发送给郑智铭到期通知”')
    return prepareDueSms(access.userId, customerName, 0)
  }
  if (intent === 'customer-due' && customerName) {
    const dueAnswer = await customerDueAnswer(access.userId, customerName, 0)
    if (dueAnswer) return dueAnswer
    throw new Error(`当前店铺未找到客户“${customerName}”的有效合同`)
  }
  if (intent === 'customer' && customerName) {
    const directAnswer = await customerAnswer(access.userId, customerName, 0)
    if (directAnswer) return directAnswer
    throw new Error(`当前店铺未找到客户“${customerName}”的有效合同`)
  }
  const context = intent === 'business' ? await getBusinessContext(access.userId) : null
  const remainingRequests = await reserveFreeUsage(access.userId)
  const messages = history.slice(-MAX_HISTORY).map((item) => ({ role: item.role, content: item.content.slice(0, 800) }))
  const prompt = context
    ? `你是“小维”，中国电脑租赁店的业务助手。只允许依据下方实时数据回答，禁止编造、禁止声称已执行收款、退租或改合同等操作。回答使用简洁中文，先给结论，再说明关键依据和建议；金额保留两位小数。若数据不足，明确说明。\n店铺：${access.shopName}\n统计日期：${context.today}\n实时数据：\n- ${context.facts.join('\n- ')}\n用户问题：${text}`
    : `你是“小维”，中国电脑租赁店的友好业务助手。请自然、简洁地回应用户，能够正常闲聊和解释租赁业务常识。不要把普通聊天误判为客户查询，不要编造店铺数据，也不要声称已经执行任何业务操作。用户问题：${text}`
  try {
    const { env } = await getCloudflareContext({ async: true })
    if (!env.AI) throw new Error('AI binding missing')
    const result = await env.AI.run(MODEL, { messages: [{ role: 'system', content: prompt }, ...messages], max_tokens: 320, temperature: 0.2 }) as { response?: string }
    const summary = result.response?.trim()
    if (!summary) throw new Error('empty AI response')
    return {
      title: context ? '小维分析' : '小维回复', summary, facts: context?.facts.slice(0, 5) ?? [],
      scope: context ? `只读分析当前店铺“${access.shopName}”的数据，不会修改任何业务记录` : '本次为普通对话，未查询或修改店铺业务数据', updatedAt: nowText(),
      href: /逾期|待收|收款|金额/.test(text) ? '/finance' : '/rentals', hrefLabel: /逾期|待收|收款|金额/.test(text) ? '查看资金与账单' : '查看租赁管理',
      suggestions: ['哪些数据最需要我关注？', '当前逾期待收情况怎么样？', '给我一份今日经营建议'], remainingRequests, aiGenerated: true,
    }
  } catch (error) { aiUnavailable(error) }
}

function safeQuestionError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const isExpected = /^(请|当前店铺|客户|短信确认|今日 AI|小维 AI|到期提醒短信模板|.+没有已到期)/.test(message)
  return isExpected ? message : '小维查询时遇到问题，请稍后重试'
}

export async function askXiaowei(question: string, history: XiaoweiMessage[] = []): Promise<XiaoweiAnswer> {
  try {
    return await askXiaoweiInternal(question, history)
  } catch (error) {
    const summary = safeQuestionError(error)
    return {
      title: '需要补充或核对信息',
      summary,
      facts: [],
      scope: '本次请求未执行任何业务操作，也没有发送短信',
      updatedAt: nowText(),
      href: '/rentals',
      hrefLabel: '查看租赁管理',
      suggestions: summary.includes('客户姓名') ? ['陈江涛租了几台？', '发送给郑智铭到期通知'] : ['查看该客户有哪些合同', '换一个客户姓名查询'],
      remainingRequests: 0,
      aiGenerated: false,
    }
  }
}
