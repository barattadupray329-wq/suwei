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

type RentalRow = typeof rentals.$inferSelect
type ItemRow = typeof rentalItems.$inferSelect

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
const numeric = (value: unknown) => Number(value || 0)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
const monthStart = () => `${today().slice(0, 7)}-01`
const activeStatus = (status: string) => ['在租', '逾期'].includes(status)
const availableQuantity = (item: ItemRow) => Math.max(0, item.quantity - item.returnedQuantity - item.boughtOutQuantity - item.lostQuantity)

function rank<T>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number) {
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    const key = keyOf(row).trim() || '未填写'
    totals.set(key, (totals.get(key) || 0) + valueOf(row))
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
}

function getTimeRange(question: string, now: string) {
  if (/本月|这个月|当月/.test(question)) return { from: monthStart(), to: now, label: '本月' }
  if (/今年|本年/.test(question)) return { from: `${now.slice(0, 4)}-01-01`, to: now, label: '今年' }
  return { from: '', to: now, label: '' }
}

function customerKey(row: RentalRow) {
  return row.customerCompany?.trim() || row.customerName.trim() || row.customerPhone
}

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
  const time = getTimeRange(question, now)
  const inRange = (row: RentalRow) => (!time.from || row.startDate >= time.from) && row.startDate <= time.to
  const scopedRentals = official.filter(inRange)
  const scope = `${employeeScope ? `仅统计由你负责的合同（${access.actorName}）` : `统计门店全部经营数据（${access.shopName}）`}${time.label ? ` · ${time.label}` : ''}`
  const base = { scope, updatedAt: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) }

  const asksPerson = /哪个人|谁租|客户.*最多|租户.*最多|哪个公司.*最多|个人.*最多/.test(question)
  const asksAssignee = /负责人|客户经理|业务员|员工|谁的业绩|谁负责/.test(question)
  const asksConfig = /配置/.test(question)
  const asksModel = /型号|机型|设备名称/.test(question)
  const asksDeviceType = /设备类型|品类|种类|哪类|什么设备/.test(question)
  const asksRanking = /最多|最少|排行|排名|前\s*\d+|最高|最大/.test(question)
  const asksAmount = /金额|租金|收入|业绩|合同额/.test(question)

  if (asksPerson) {
    const rows = scopedRentals.filter((row) => activeStatus(row.status))
    const ranking = rank(rows, customerKey, (row) => asksAmount ? numeric(row.totalRent) : row.quantity)
    const unit = asksAmount ? '合同额' : '在租数量'
    return { ...base, title: `客户${unit}排行`, summary: ranking.length ? `${ranking[0][0]}最多，${asksAmount ? money(ranking[0][1]) : `${ranking[0][1]} 台`}。` : '当前没有可统计的客户租赁数据。', facts: ranking.map(([name, value], index) => `${index + 1}. ${name}：${asksAmount ? money(value) : `${value} 台`}`), href: '/rentals?status=active', hrefLabel: '查看客户合同' }
  }

  if (asksAssignee) {
    if (employeeScope) return { ...base, title: '负责人数据范围说明', summary: '你当前只能查看自己负责的合同，无法比较其他客户经理的业绩。', facts: [`你的正式合同 ${official.length} 份`, `你的在租合同 ${official.filter((row) => activeStatus(row.status)).length} 份`], href: '/rentals?assignee=mine', hrefLabel: '查看我的合同' }
    const rows = scopedRentals.filter((row) => activeStatus(row.status))
    const ranking = rank(rows, (row) => row.assigneeName || '未分配负责人', (row) => asksAmount ? numeric(row.totalRent) : row.quantity)
    return { ...base, title: `负责人${asksAmount ? '合同额' : '在租数量'}排行`, summary: ranking.length ? `${ranking[0][0]}当前最高，${asksAmount ? money(ranking[0][1]) : `${ranking[0][1]} 台`}。` : '当前没有可统计的负责人数据。', facts: ranking.map(([name, value], index) => `${index + 1}. ${name}：${asksAmount ? money(value) : `${value} 台`}`), href: '/rentals', hrefLabel: '查看合同明细' }
  }

  if (/逾期|待收|欠款|应收|催收/.test(question)) {
    const outstanding = bills.map((bill) => ({ ...bill, unpaid: Math.max(0, numeric(bill.amount) - numeric(bill.paidAmount)) })).filter((bill) => bill.unpaid > 0)
    const overdue = outstanding.filter((bill) => bill.dueDate < now)
    const customers = new Set(overdue.map((bill) => official.find((rental) => rental.id === bill.rentalId)?.customerPhone).filter(Boolean))
    return { ...base, title: '待收与逾期分析', summary: `当前待收 ${money(outstanding.reduce((sum, bill) => sum + bill.unpaid, 0))}，其中逾期 ${money(overdue.reduce((sum, bill) => sum + bill.unpaid, 0))}。`, facts: [`待收账单 ${outstanding.length} 笔`, `逾期账单 ${overdue.length} 笔`, `涉及逾期客户 ${customers.size} 位`], href: '/rentals?settlement=outstanding', hrefLabel: '查看待收合同' }
  }

  if (/到期|续租/.test(question)) {
    const match = question.match(/(\d+)\s*天/)
    const days = Math.min(90, Math.max(1, Number(match?.[1] || 7)))
    const end = new Date(`${now}T00:00:00+08:00`); end.setDate(end.getDate() + days)
    const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(end)
    const due = official.filter((row) => activeStatus(row.status) && row.endDate >= now && row.endDate <= endDate)
    return { ...base, title: `未来 ${days} 天到期提醒`, summary: `共有 ${due.length} 份合同、${due.reduce((sum, row) => sum + row.quantity, 0)} 台设备将在 ${endDate} 前到期。`, facts: due.slice(0, 3).map((row) => `${row.customerName}：${row.contractNo}，${row.endDate} 到期`).concat(due.length > 3 ? [`另有 ${due.length - 3} 份合同`] : []), href: '/rentals?status=active', hrefLabel: '查看在租合同' }
  }

  if (asksConfig || asksModel || asksDeviceType || (/设备/.test(question) && asksRanking)) {
    const activeIds = new Set(scopedRentals.filter((row) => activeStatus(row.status)).map((row) => row.id))
    const activeItems = items.filter((item) => activeIds.has(item.rentalId))
    const key: 'deviceConfig' | 'deviceName' | 'deviceType' = asksConfig ? 'deviceConfig' : asksModel ? 'deviceName' : 'deviceType'
    const label = key === 'deviceConfig' ? '配置' : key === 'deviceName' ? '型号' : '设备类型'
    const ranking = rank(activeItems, (item) => String(item[key] || '未填写'), availableQuantity)
    return { ...base, title: `在租${label}排行`, summary: ranking.length ? `${ranking[0][0]} 当前最多，共 ${ranking[0][1]} 台。` : '当前没有可统计的在租设备。', facts: ranking.map(([name, count], index) => `${index + 1}. ${name}：${count} 台`), href: '/rentals?status=active', hrefLabel: '查看在租设备' }
  }

  if (/风险|风控|异常|押金/.test(question)) {
    const overdueBills = bills.filter((bill) => bill.dueDate < now && numeric(bill.amount) > numeric(bill.paidAmount))
    const overdueIds = new Set(overdueBills.map((bill) => bill.rentalId))
    const noDeposit = official.filter((row) => activeStatus(row.status) && numeric(row.deposit) <= 0)
    const overdueContracts = official.filter((row) => overdueIds.has(row.id))
    const highQuantity = official.filter((row) => activeStatus(row.status) && row.quantity >= 10)
    const level = overdueContracts.length >= 5 || noDeposit.length >= 5 ? '高' : overdueContracts.length || noDeposit.length || highQuantity.length ? '中' : '低'
    return { ...base, title: '经营风控扫描', summary: `当前综合关注等级为“${level}”。这是经营提示，不替代人工审核。`, facts: [`逾期合同 ${overdueContracts.length} 份`, `在租但押金为 0 的合同 ${noDeposit.length} 份`, `单份在租数量达 10 台以上的合同 ${highQuantity.length} 份`], href: '/rentals', hrefLabel: '查看合同核实' }
  }

  if (/本月|这个月|当月|今年|本年|租了多少|租出|新增/.test(question)) {
    const quantity = scopedRentals.reduce((sum, row) => sum + row.quantity, 0)
    const amount = scopedRentals.reduce((sum, row) => sum + numeric(row.totalRent), 0)
    const label = time.label || '当前查询范围'
    return { ...base, title: `${label}租赁概况`, summary: `${label}新增 ${scopedRentals.length} 份正式合同，共租出 ${quantity} 台设备。`, facts: [`合同总额 ${money(amount)}`, `统计截止 ${now}`, `平均每份合同 ${(quantity / Math.max(1, scopedRentals.length)).toFixed(1)} 台`], href: time.from ? `/rentals?startFrom=${time.from}&startTo=${now}` : '/rentals', hrefLabel: `查看${label}合同` }
  }

  if (/哪个|哪种|哪类|谁|最多|排行/.test(question)) {
    return { ...base, title: '请确认你想比较什么', summary: '这个问题可能指客户、负责人或设备，我需要你再明确一点。', facts: ['客户：哪个客户在租设备最多？', '负责人：哪个客户经理负责的合同额最高？', '设备：哪个型号或配置在租最多？'], href: '/dashboard', hrefLabel: '查看经营总览' }
  }

  return { ...base, title: '我还需要更明确的问题', summary: '我目前擅长查询系统已有的经营数据，不会猜测数据库中没有的信息。', facts: ['试试问：这个月租了多少台？', '试试问：哪个客户租得最多？', '试试问：哪个型号在租最多？', '试试问：未来 7 天哪些合同到期？'], href: '/dashboard', hrefLabel: '查看经营总览' }
}
