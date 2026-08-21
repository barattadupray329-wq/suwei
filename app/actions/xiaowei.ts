'use server'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { and, eq, sql } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { aiUsageDaily, paymentRecords, receivableBills, rentalEvents, rentals } from '@/lib/db/schema'

export type XiaoweiMessage = { role: 'user' | 'assistant'; content: string }
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
}

const MODEL = '@cf/meta/llama-3.2-1b-instruct'
const DAILY_NEURON_BUDGET = 9000
const RESERVED_NEURONS_PER_REQUEST = 450
const MAX_HISTORY = 6
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const chinaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const nowText = () => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date())

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

async function getBusinessContext(userId: string, question: string) {
  const today = chinaDate()
  const month = today.slice(0, 7)
  const [[active], [due], [overdue], [paid], events] = await Promise.all([
    db.select({ contracts: sql<number>`count(*)`, quantity: sql<number>`coalesce(sum(${rentals.quantity}), 0)`, rent: sql<number>`coalesce(sum(cast(${rentals.totalRent} as real)), 0)` }).from(rentals).where(and(eq(rentals.userId, userId), eq(rentals.lifecycleStatus, 'active'), sql`${rentals.quantity} > 0`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${receivableBills.amount} as real) - cast(${receivableBills.paidAmount} as real)), 0)` }).from(receivableBills).where(and(eq(receivableBills.userId, userId), sql`cast(${receivableBills.amount} as real) > cast(${receivableBills.paidAmount} as real)`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${receivableBills.amount} as real) - cast(${receivableBills.paidAmount} as real)), 0)` }).from(receivableBills).where(and(eq(receivableBills.userId, userId), sql`cast(${receivableBills.amount} as real) > cast(${receivableBills.paidAmount} as real)`, sql`${receivableBills.dueDate} < ${today}`)),
    db.select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(cast(${paymentRecords.amount} as real)), 0)` }).from(paymentRecords).where(and(eq(paymentRecords.userId, userId), sql`substr(${paymentRecords.paymentDate}, 1, 7) = ${month}`)),
    db.select({ type: rentalEvents.eventType, count: sql<number>`count(*)` }).from(rentalEvents).where(and(eq(rentalEvents.userId, userId), sql`substr(${rentalEvents.eventDate}, 1, 7) = ${month}`)).groupBy(rentalEvents.eventType),
  ])
  let customerFacts: string[] = []
  const keyword = question.match(/[\u4e00-\u9fa5A-Za-z·]{2,12}/)?.[0]
  if (keyword && !/现在|多少|合同|设备|本月|待收|逾期|收款|经营|分析/.test(keyword)) {
    const rows = await db.select({ contractNo: rentals.contractNo, customerName: rentals.customerName, quantity: rentals.quantity, status: rentals.status }).from(rentals).where(and(eq(rentals.userId, userId), sql`${rentals.customerName} like ${`%${keyword}%`}`, eq(rentals.lifecycleStatus, 'active'))).limit(10)
    customerFacts = rows.map((row) => `${row.customerName}｜${row.contractNo}｜${row.quantity}台｜${row.status}`)
  }
  const facts = [
    `在租合同：${Number(active?.contracts || 0)}份；在租设备：${Number(active?.quantity || 0)}台；合同金额合计：${money(Number(active?.rent || 0))}`,
    `当前待收：${money(Number(due?.amount || 0))}（${Number(due?.count || 0)}笔）`,
    `逾期待收：${money(Number(overdue?.amount || 0))}（${Number(overdue?.count || 0)}笔）`,
    `本月实际收款：${money(Number(paid?.amount || 0))}（${Number(paid?.count || 0)}笔，包含冲正负数）`,
    `本月业务：${events.length ? events.map((item) => `${item.type}${item.count}次`).join('、') : '暂无记录'}`,
    ...customerFacts,
  ]
  return { facts, today, month }
}

export async function askXiaowei(question: string, history: XiaoweiMessage[] = []): Promise<XiaoweiAnswer> {
  const access = await getAccessContext('租赁操作')
  const text = question.trim()
  if (text.length < 2) throw new Error('请告诉小维你想查询什么')
  if (text.length > 300) throw new Error('问题请控制在 300 字以内')
  const context = await getBusinessContext(access.userId, text)
  const remainingRequests = await reserveFreeUsage(access.userId)
  const messages = history.slice(-MAX_HISTORY).map((item) => ({ role: item.role, content: item.content.slice(0, 800) }))
  const prompt = `你是“小维”，中国电脑租赁店的只读业务助手。只允许依据下方实时数据回答，禁止编造、禁止声称已执行收款/退租/改合同等操作。回答使用简洁中文，先给结论，再说明关键依据和建议；金额保留两位小数。若数据不足，明确说需要去哪个页面核对。\n店铺：${access.shopName}\n统计日期：${context.today}\n实时数据：\n- ${context.facts.join('\n- ')}\n用户问题：${text}`
  try {
    const { env } = await getCloudflareContext({ async: true })
    if (!env.AI) throw new Error('AI binding missing')
    const result = await env.AI.run(MODEL, { messages: [{ role: 'system', content: prompt }, ...messages], max_tokens: 320, temperature: 0.2 }) as { response?: string }
    const summary = result.response?.trim()
    if (!summary) throw new Error('empty AI response')
    return {
      title: '小维分析', summary, facts: context.facts.slice(0, 5),
      scope: `只读分析当前店铺“${access.shopName}”的数据，不会修改任何业务记录`, updatedAt: nowText(),
      href: /逾期|待收|收款|金额/.test(text) ? '/finance' : '/rentals', hrefLabel: /逾期|待收|收款|金额/.test(text) ? '查看资金与账单' : '查看租赁管理',
      suggestions: ['哪些数据最需要我关注？', '当前逾期待收情况怎么样？', '给我一份今日经营建议'], remainingRequests, aiGenerated: true,
    }
  } catch (error) { aiUnavailable(error) }
}
