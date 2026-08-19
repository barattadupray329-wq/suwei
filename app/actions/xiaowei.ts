'use server'

import { and, eq } from 'drizzle-orm'
import { getAccessContext } from '@/lib/access'
import { db } from '@/lib/db'
import { receivableBills, rentalItems, rentals } from '@/lib/db/schema'

export type XiaoweiAnswer = {
  title: string
  summary: string
  facts: string[]
  scope: string
  href: string
  hrefLabel: string
  updatedAt: string
}

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
const number = (value: unknown) => Number(value || 0)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const monthStart = () => `${today().slice(0, 7)}-01`

export async function askXiaowei(rawQuestion: string): Promise<XiaoweiAnswer> {
  const question = rawQuestion.trim().slice(0, 200)
  if (question.length < 2) throw new Error('请把问题描述得更具体一些')
  const access = await getAccessContext('租赁操作')
  if (access.role === 'super_admin' || !access.shopId) throw new Error('平台主管不访问店铺经营数据')

  const employeeScope = access.role === 'employee'
  const rentalWhere = employeeScope
    ? and(eq(rentals.userId, access.userId), eq(rentals.assigneeUserId, access.actorId))
    : eq(rentals.userId, access.userId)
  const allRentals = await db.select().from(rentals).where(rentalWhere)
  const official = allRentals.filter((row) => row.orderType === 'official' && row.lifecycleStatus !== 'deleted')
  const rentalIds = new Set(official.map((row) => row.id))
  const [allItems, allBills] = await Promise.all([
    db.select().from(rentalItems).where(eq(rentalItems.userId, access.userId)),
    db.select().from(receivableBills).where(eq(receivableBills.userId, access.userId)),
  ])
  const items = allItems.filter((row) => rentalIds.has(row.rentalId))
  const bills = allBills.filter((row) => rentalIds.has(row.rentalId))
  const now = today()
  const scope = employeeScope ? `仅统计由你负责的合同（${access.actorName}）` : `统计门店全部经营数据（${access.shopName}）`
  const base = { scope, updatedAt: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }

  if (/逾期|待收|欠款|应收|催收/.test(question)) {
    const outstanding = bills.map((bill) => ({ ...bill, unpaid: Math.max(0, number(bill.amount) - number(bill.paidAmount)) })).filter((bill) => bill.unpaid > 0)
    const overdue = outstanding.filter((bill) => bill.dueDate < now)
    const customers = new Set(overdue.map((bill) => official.find((rental) => rental.id === bill.rentalId)?.customerPhone).filter(Boolean))
    return { ...base, title: '待收与逾期分析', summary: `当前待收 ${money(outstanding.reduce((sum, bill) => sum + bill.unpaid, 0))}，其中逾期 ${money(overdue.reduce((sum, bill) => sum + bill.unpaid, 0))}。`, facts: [`待收账单 ${outstanding.length} 笔`, `逾期账单 ${overdue.length} 笔`, `涉及逾期客户 ${customers.size} 位`], href: '/rentals?settlement=outstanding', hrefLabel: '查看待收合同' }
  }

  if (/到期|续租/.test(question)) {
    const match = question.match(/(\d+)\s*天/)
    const days = Math.min(90, Math.max(1, Number(match?.[1] || 7)))
    const end = new Date(`${now}T00:00:00+08:00`); end.setDate(end.getDate() + days)
    const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(end)
    const due = official.filter((row) => ['在租', '逾期'].includes(row.status) && row.endDate >= now && row.endDate <= endDate)
    const quantity = due.reduce((sum, row) => sum + row.quantity, 0)
    return { ...base, title: `未来 ${days} 天到期提醒`, summary: `共有 ${due.length} 份合同、${quantity} 台设备将在 ${endDate} 前到期。`, facts: due.slice(0, 3).map((row) => `${row.customerName}：${row.contractNo}，${row.endDate} 到期`).concat(due.length > 3 ? [`另有 ${due.length - 3} 份合同`] : []), href: '/rentals?status=active', hrefLabel: '查看在租合同' }
  }

  if (/型号|配置|设备|最多|排行/.test(question)) {
    const activeIds = new Set(official.filter((row) => ['在租', '逾期'].includes(row.status)).map((row) => row.id))
    const activeItems = items.filter((item) => activeIds.has(item.rentalId))
    const key = /配置/.test(question) ? 'deviceConfig' : /型号/.test(question) ? 'deviceName' : 'deviceType'
    const label = key === 'deviceConfig' ? '配置' : key === 'deviceName' ? '型号' : '设备类型'
    const counts = new Map<string, number>()
    activeItems.forEach((item) => { const name = String(item[key] || '未填写'); const available = Math.max(0, item.quantity - item.returnedQuantity - item.boughtOutQuantity - item.lostQuantity); counts.set(name, (counts.get(name) || 0) + available) })
    const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { ...base, title: `在租${label}排行`, summary: ranking.length ? `${ranking[0][0]} 当前最多，共 ${ranking[0][1]} 台。` : '当前没有可统计的在租设备。', facts: ranking.map(([name, count], index) => `${index + 1}. ${name}：${count} 台`), href: '/rentals?status=active', hrefLabel: '查看在租设备' }
  }

  if (/风险|风控|异常|押金/.test(question)) {
    const overdueBills = bills.filter((bill) => bill.dueDate < now && number(bill.amount) > number(bill.paidAmount))
    const overdueIds = new Set(overdueBills.map((bill) => bill.rentalId))
    const noDeposit = official.filter((row) => ['在租', '逾期'].includes(row.status) && number(row.deposit) <= 0)
    const overdueContracts = official.filter((row) => overdueIds.has(row.id))
    const highQuantity = official.filter((row) => ['在租', '逾期'].includes(row.status) && row.quantity >= 10)
    const level = overdueContracts.length >= 5 || noDeposit.length >= 5 ? '高' : overdueContracts.length || noDeposit.length || highQuantity.length ? '中' : '低'
    return { ...base, title: '经营风控扫描', summary: `当前综合关注等级为“${level}”。这是经营提示，不替代人工审核。`, facts: [`逾期合同 ${overdueContracts.length} 份`, `在租但押金为 0 的合同 ${noDeposit.length} 份`, `单份在租数量达 10 台以上的合同 ${highQuantity.length} 份`], href: '/rentals', hrefLabel: '查看合同核实' }
  }

  if (/本月|这个月|租了多少|租出|新增/.test(question)) {
    const created = official.filter((row) => row.startDate >= monthStart() && row.startDate <= now)
    const quantity = created.reduce((sum, row) => sum + row.quantity, 0)
    const amount = created.reduce((sum, row) => sum + number(row.totalRent), 0)
    return { ...base, title: '本月租赁概况', summary: `本月新增 ${created.length} 份正式合同，共租出 ${quantity} 台设备。`, facts: [`合同总额 ${money(amount)}`, `统计区间 ${monthStart()} 至 ${now}`, `平均每份合同 ${(quantity / Math.max(1, created.length)).toFixed(1)} 台`], href: `/rentals?startFrom=${monthStart()}&startTo=${now}`, hrefLabel: '查看本月合同' }
  }

  return { ...base, title: '我还需要更明确的问题', summary: '我目前擅长查询系统已有的经营数据，不会猜测数据库中没有的信息。', facts: ['试试问：这个月租了多少台？', '试试问：哪个型号在租最多？', '试试问：未来 7 天哪些合同到期？', '试试问：帮我分析逾期和经营风险'], href: '/dashboard', hrefLabel: '查看经营总览' }
}
