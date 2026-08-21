'use server'

import { and, eq, sql } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { paymentRecords, receivableBills, rentalEvents, rentals } from '@/lib/db/schema'

export type XiaoweiAnswer = {
  title: string
  summary: string
  facts: string[]
  scope: string
  updatedAt: string
  href: string
  hrefLabel: string
  suggestions?: string[]
  needsClarification?: boolean
}

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const nowText = () => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date())

export async function askXiaowei(question: string): Promise<XiaoweiAnswer> {
  const access = await getAccessContext('租赁操作')
  const text = question.trim()
  if (text.length < 2) throw new Error('请告诉小维你想查询什么')
  const base = { scope: `仅统计当前店铺“${access.shopName}”的数据`, updatedAt: nowText() }

  if (/待收|欠款|逾期/.test(text)) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
    const overdueOnly = /逾期/.test(text)
    const [result] = await db.select({ amount: sql<number>`coalesce(sum(cast(${receivableBills.amount} as real) - cast(${receivableBills.paidAmount} as real)), 0)`, count: sql<number>`count(*)` }).from(receivableBills).where(and(eq(receivableBills.userId, access.userId), sql`cast(${receivableBills.amount} as real) > cast(${receivableBills.paidAmount} as real)`, overdueOnly ? sql`${receivableBills.dueDate} < ${today}` : sql`1 = 1`))
    return { ...base, title: overdueOnly ? '逾期待收' : '当前待收', summary: `${overdueOnly ? '逾期' : '尚未收回'}金额合计 ${money(Number(result?.amount || 0))}，涉及 ${Number(result?.count || 0)} 笔账单。`, facts: ['金额按账单应收减去已收实时计算', overdueOnly ? `到期日在 ${today} 之前且尚未结清` : '包含未结清的租金及其他应收'], href: '/finance', hrefLabel: '查看资金流水' }
  }

  if (/实际.*收|收款|收入最高/.test(text)) {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date())
    const [result] = await db.select({ amount: sql<number>`coalesce(sum(cast(${paymentRecords.amount} as real)), 0)`, count: sql<number>`count(*)` }).from(paymentRecords).where(and(eq(paymentRecords.userId, access.userId), sql`substr(${paymentRecords.paymentDate}, 1, 7) = ${month}`))
    return { ...base, title: '本月实际收款', summary: `本月登记收款 ${money(Number(result?.amount || 0))}，共 ${Number(result?.count || 0)} 笔。`, facts: [`统计月份：${month}`, '冲正退款会以资金流水记录反映'], href: '/finance', hrefLabel: '查看本月流水' }
  }

  if (/退租|续租|维修|换机|丢失|买断/.test(text)) {
    const eventType = ['退租', '续租', '维修', '换机', '丢失', '买断'].find((type) => text.includes(type)) || '退租'
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date())
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(rentalEvents).where(and(eq(rentalEvents.userId, access.userId), eq(rentalEvents.eventType, eventType), sql`substr(${rentalEvents.eventDate}, 1, 7) = ${month}`))
    return { ...base, title: `本月${eventType}情况`, summary: `本月共有 ${Number(result?.count || 0)} 次${eventType}记录。`, facts: [`统计月份：${month}`, '业务记录保留历史，不因合同结束而删除'], href: '/audit-logs', hrefLabel: '查看业务记录' }
  }

  const customer = text.match(/([\u4e00-\u9fa5A-Za-z·]{2,12})(?:先生|女士|公司)/)?.[0]
  if (customer) {
    const rows = await db.select({ contractNo: rentals.contractNo, customerName: rentals.customerName, quantity: rentals.quantity, status: rentals.status }).from(rentals).where(and(eq(rentals.userId, access.userId), sql`${rentals.customerName} like ${`%${customer.replace(/还有.*$/, '')}%`}`, eq(rentals.lifecycleStatus, 'active'))).limit(20)
    const active = rows.filter((row) => row.status !== '已退租' && row.quantity > 0)
    const quantity = active.reduce((sum, row) => sum + row.quantity, 0)
    return { ...base, title: `${customer}的在租情况`, summary: `${customer}当前有 ${active.length} 份在租合同、${quantity} 台设备在租。`, facts: active.length ? active.map((row) => `${row.contractNo}：${row.quantity} 台`) : ['未查询到在租设备'], href: `/rentals?query=${encodeURIComponent(customer)}`, hrefLabel: '查看客户合同' }
  }

  const [active] = await db.select({ count: sql<number>`count(*)`, quantity: sql<number>`coalesce(sum(${rentals.quantity}), 0)`, rent: sql<number>`coalesce(sum(cast(${rentals.totalRent} as real)), 0)` }).from(rentals).where(and(eq(rentals.userId, access.userId), eq(rentals.lifecycleStatus, 'active'), sql`${rentals.quantity} > 0`))
  if (/合同|在租|设备|经营|多少/.test(text)) return { ...base, title: '当前租赁经营概况', summary: `当前共有 ${Number(active?.count || 0)} 份在租合同、${Number(active?.quantity || 0)} 台设备在租。`, facts: [`合同金额合计 ${money(Number(active?.rent || 0))}`, '已退租、草稿和已删除合同不计入在租'], href: '/rentals', hrefLabel: '查看租赁管理' }

  return { ...base, title: '请再说具体一点', summary: '我可以查询合同、客户、设备、收款、待收、逾期和各类业务记录。', facts: ['例如：现在有多少份在租合同？', '例如：当前逾期待收多少钱？'], suggestions: ['现在有多少份在租合同？', '本月实际收了多少租金？', '当前逾期待收多少钱？'], needsClarification: true, href: '/dashboard', hrefLabel: '查看经营总览' }
}
