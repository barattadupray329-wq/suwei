'use client'

import Link from 'next/link'
import { useTransition, useState } from 'react'
import { ArrowLeft, Banknote, CalendarClock, ChevronDown, LogOut, Monitor, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { loginCustomerPortal, logoutCustomerPortal } from '@/app/actions/portal-auth'
import { userErrorMessage } from '@/lib/errors'
import { addCalendarDays, billCoverageLabel, billState, dueBillsAsOf } from '@/lib/rental-calculations'

const money = (value: string | number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value || 0))
const day = (value?: string | Date | null) => (value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '—')
const today = () => new Date().toISOString().slice(0, 10)
const daysUntil = (value: string) => Math.ceil((new Date(value).getTime() - new Date(today()).getTime()) / 86400000)

const ACTIVE_STATUS = ['在租', '即将到期', '逾期', '部分归还', '进行中']
const num = (value: unknown) => Number(value || 0)

export function PortalLogin({ token, storeName }: { token: string; storeName: string }) {
  const [pending, start] = useTransition(); const [phone, setPhone] = useState(''); const [password, setPassword] = useState('')
  return <main className="min-h-svh bg-background px-4 py-10"><div className="mx-auto flex max-w-md flex-col gap-6"><header className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Monitor className="size-7"/></span><h1 className="mt-4 text-2xl font-bold text-balance">{storeName}客户服务中心</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">集中查看设备、合同期限、费用情况与服务记录</p></header><form className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm" onSubmit={e=>{e.preventDefault();start(async()=>{try{await loginCustomerPortal(token,phone,password);location.reload()}catch(error){toast.error(userErrorMessage(error,'登录失败，请稍后重试'))}})}}><label className="flex flex-col gap-2 text-sm font-medium">合同手机号<input inputMode="tel" autoComplete="tel" className="h-12 rounded-xl border bg-background px-4 text-base" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="请输入完整手机号"/></label><label className="flex flex-col gap-2 text-sm font-medium">专属密码<input type="password" autoComplete="current-password" className="h-12 rounded-xl border bg-background px-4 text-base" value={password} onChange={e=>setPassword(e.target.value)} placeholder="请输入管理员提供的密码"/></label><button disabled={pending} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">{pending?'正在验证…':'安全登录'}</button><p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0"/>此入口仅供已开通客户使用，请妥善保管登录信息。</p></form></div></main>
}

type Row = Record<string, any>
const rowsBy = (rows: Row[], rentalId: number) => rows.filter((row) => row.rentalId === rentalId)

function contractRank(contract: Row) {
  if (!ACTIVE_STATUS.includes(contract.status)) return 4
  const remaining = daysUntil(contract.endDate)
  if (remaining < 0) return 0
  if (remaining <= 7) return 1
  if (remaining <= 30) return 2
  return 3
}

// 当前待付：已到付款日（含逾期）且未结清的应收账单；下期预告：最近一期未到付款日的账单
function billing(bills: Row[]) {
  const open = bills.map((bill) => ({ ...bill, amount: String(bill.amount), paidAmount: String(bill.paidAmount), dueDate: String(bill.dueDate), due: Math.max(0, num(bill.amount) - num(bill.paidAmount)) })).filter((bill) => bill.due > 0)
  const now = today()
  const dueNow = dueBillsAsOf(open, now)
  const currentDue = dueNow.reduce((sum, bill) => sum + bill.due, 0)
  const settled = bills.filter((bill) => num(bill.paidAmount) >= num(bill.amount) && bill.billType !== '押金').sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0]
  return {
    currentDue,
    dueBills: dueNow,
    paidThrough: settled ? addCalendarDays(settled.periodEnd, 1) : null,
  }
}

function deviceStatus(items: Row[]): Row[] {
  return items.map((item): Row => {
    const total = num(item.quantity)
    const returned = num(item.returnedQuantity), lost = num(item.lostQuantity), bought = num(item.boughtOutQuantity)
    const renting = Math.max(0, total - returned - lost - bought)
    return { ...item, renting, returned, lost, bought }
  })
}

export function PortalDashboard({ token, data, preview = false }: { token?: string; data: Row; preview?: boolean }) {
  const contracts: Row[] = [...data.contracts].sort((a, b) => contractRank(a) - contractRank(b) || a.endDate.localeCompare(b.endDate))
  const active = contracts.filter((contract) => ACTIVE_STATUS.includes(contract.status))
  const ended = contracts.filter((contract) => !ACTIVE_STATUS.includes(contract.status)).sort((a, b) => (b.updatedAt || '').toString().localeCompare((a.updatedAt || '').toString()))
  const allDevices = deviceStatus(data.items)
  const rentingTotal = allDevices.reduce((sum, item) => sum + (ACTIVE_STATUS.includes(contracts.find((c) => c.id === item.rentalId)?.status) ? item.renting : 0), 0)
  const currentDueTotal = billing(data.bills).currentDue
  const deposit = data.ledger.reduce((sum: number, entry: Row) => sum + (entry.entryType === '押金收取' ? num(entry.amount) : entry.entryType.startsWith('押金') ? -Math.abs(num(entry.amount)) : 0), 0)
  const levelLabels: Record<string, string> = { silver: '银牌', gold: '金牌', diamond: '钻石', king: '王者' }

  return <main className="min-h-svh bg-background pb-12">
    {preview ? <aside className="sticky top-0 z-40 border-b bg-accent px-4 py-3 text-accent-foreground shadow-sm"><div className="mx-auto flex max-w-3xl items-center justify-between gap-3"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-5 shrink-0"/><div><p className="text-sm font-semibold">管理员预览模式</p><p className="text-xs leading-5 opacity-80">这是客户实际看到的只读页面，不会创建客户登录会话。</p></div></div><Link href="/customer-portals" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-current/20 px-3 py-2 text-sm font-medium"><ArrowLeft className="size-4"/>返回客户服务</Link></div></aside> : null}
    <header className="bg-primary px-4 pb-10 pt-6 text-primary-foreground"><div className="mx-auto flex max-w-3xl items-start justify-between gap-4"><div><p className="text-sm opacity-80">{data.settings?.storeName || '速维租赁管理'}</p><h1 className="mt-1 text-2xl font-bold text-balance">你好，{data.portal.customerName}</h1><p className="mt-2 flex items-center gap-2 text-sm opacity-80"><span>手机号 {data.portal.phone.slice(0, 3)}****{data.portal.phone.slice(-4)}</span><span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">{levelLabels[data.portal.customerLevel] || '银牌'}客户</span></p></div>{!preview && token ? <form action={() => logoutCustomerPortal(token)}><button aria-label="退出登录" className="rounded-xl border border-primary-foreground/30 p-2"><LogOut className="size-5"/></button></form> : null}</div></header>

    <div className="mx-auto -mt-6 flex max-w-3xl flex-col gap-5 px-4">
      <section className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm md:grid-cols-4">
        <Summary icon={<Monitor/>} label="在租设备" value={`${rentingTotal} 台`}/>
        <Summary icon={<CalendarClock/>} label="进行中合同" value={`${active.length} 份`}/>
        <Summary icon={<Banknote/>} label="当前待付" value={money(currentDueTotal)} highlight={currentDueTotal > 0}/>
        <Summary icon={<ShieldCheck/>} label="押金余额" value={money(deposit)}/>
      </section>

      <section className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5"/></span><div className="flex-1"><p className="text-sm text-muted-foreground">专属{data.manager?.title || '客户经理'}</p><p className="font-semibold">{data.manager?.name || '门店客服'}</p></div>{data.manager?.phone ? <a href={`tel:${data.manager.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><Phone className="size-4"/>{data.manager.phone}</a> : null}</section>

      {currentDueTotal > 0 ? <section className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm"><div><p className="text-sm font-semibold text-destructive">当前已到付款日</p><h2 className="mt-1 text-xl font-bold">本次应付 {money(currentDueTotal)}</h2><p className="mt-1 text-sm text-muted-foreground">仅显示截至今天已到付款日的账单，未来账单不会提前显示。</p></div>{active.flatMap((contract) => billing(rowsBy(data.bills, contract.id)).dueBills.map((bill: Row) => <div key={bill.id} className="rounded-xl bg-card p-3"><p className="text-sm font-semibold">{contract.contractNo} · {bill.billType}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">付款日 {day(bill.dueDate)} · 覆盖 {billCoverageLabel(bill.periodStart, bill.periodEnd)} · 待付 {money(bill.due)}</p></div>))}</section> : <section className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">今天暂无已到付款日的账单。</section>}

      {active.length ? <section className="flex flex-col gap-3"><h2 className="text-lg font-bold">进行中的租赁 <span className="text-sm font-normal text-muted-foreground">（{active.length} 份，快到期已置顶）</span></h2>{active.map((contract) => <ContractCard key={contract.id} contract={contract} data={data} devices={allDevices.filter((item) => item.rentalId === contract.id)}/>)}</section> : <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">当前没有进行中的租赁</div>}

      {ended.length ? <details className="rounded-2xl border bg-card"><summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-semibold">已结束 / 已退租（{ended.length} 份）<ChevronDown className="size-5"/></summary><div className="flex flex-col gap-3 border-t p-4">{ended.map((contract) => <ContractCard key={contract.id} contract={contract} data={data} devices={allDevices.filter((item) => item.rentalId === contract.id)} archived/>)}</div></details> : null}
    </div>
  </main>
}

function ContractCard({ contract, data, devices, archived }: { contract: Row; data: Row; devices: Row[]; archived?: boolean }) {
  const remaining = daysUntil(contract.endDate)
  const overdue = ACTIVE_STATUS.includes(contract.status) && remaining < 0
  const soon = ACTIVE_STATUS.includes(contract.status) && remaining >= 0 && remaining <= 30
  const bill = billing(rowsBy(data.bills, contract.id))
  const rentingCount = devices.reduce((sum, item) => sum + item.renting, 0)
  const typeCounts = new Map<string, number>()
  for (const item of devices) {
    if (item.renting <= 0) continue
    const type = item.deviceType === '台式机' ? '主机' : (item.deviceType || '其他设备')
    typeCounts.set(type, (typeCounts.get(type) || 0) + item.renting)
  }
  const rentingByType = Array.from(typeCounts.entries())
  return <details className="group rounded-2xl border bg-card shadow-sm open:ring-1 open:ring-border" open={!archived && (overdue || soon)}>
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4"><div className="flex flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><strong>{contract.contractNo}</strong><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{contract.status}</span>{overdue ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">已逾期 {Math.abs(remaining)} 天</span> : soon ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">剩余 {remaining} 天到期</span> : null}</div><p className="text-sm text-muted-foreground">{day(contract.startDate)} 至 {day(contract.endDate)}</p><div className="flex flex-wrap items-center gap-2 text-sm"><span>在租 <strong>{rentingCount}</strong> 台</span>{rentingByType.map(([type, count]) => <span key={type} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{type} ×{count}</span>)}{ACTIVE_STATUS.includes(contract.status) ? <span className={bill.currentDue > 0 ? 'text-destructive' : 'text-muted-foreground'}>当前待付 <strong>{money(bill.currentDue)}</strong></span> : null}{bill.paidThrough ? <span className="text-muted-foreground">已付覆盖至 {day(bill.paidThrough)}（不含）</span> : null}</div></div><ChevronDown className="mt-1 size-5 shrink-0 transition group-open:rotate-180"/></summary>
    <div className="flex flex-col gap-5 border-t p-4">
      <Block title="设备状态" icon={<Monitor/>}>{devices.map((item) => <div key={item.id} className="rounded-xl bg-muted p-3"><p className="text-sm font-medium">{item.deviceType} · {item.deviceName} × {item.quantity}</p><div className="mt-2 flex flex-wrap gap-2 text-xs">{item.renting > 0 ? <Tag tone="primary">在租 {item.renting}</Tag> : null}{item.returned > 0 ? <Tag>已归还 {item.returned}</Tag> : null}{item.bought > 0 ? <Tag>已买断 {item.bought}</Tag> : null}{item.lost > 0 ? <Tag tone="destructive">丢失 {item.lost}</Tag> : null}</div></div>)}</Block>
      <Block title="当前应付账单" icon={<Banknote/>}>{billing(rowsBy(data.bills, contract.id)).dueBills.map((item: Row) => <BillLine key={item.id} bill={item}/>)}</Block>
      <Block title="付款记录" icon={<Banknote/>}>{rowsBy(data.payments, contract.id).map((item: Row) => <Line key={item.id} title={`${day(item.paymentDate)} · ${item.feeType}`} detail={`${money(item.amount)} · ${item.paymentMethod}`}/>)}</Block>
      {rowsBy(data.returns, contract.id).length ? <Block title="归还记录" icon={<Monitor/>}>{rowsBy(data.returns, contract.id).map((item: Row) => <Line key={item.id} title={`${day(item.returnDate)} 归还 ${item.quantity} 台`} detail={`成色 ${item.condition}`}/>)}</Block> : null}
      {rowsBy(data.events, contract.id).length ? <Block title="服务记录" icon={<Monitor/>}>{rowsBy(data.events, contract.id).map((item: Row) => <Line key={item.id} title={`${day(item.eventDate)} · ${item.eventType}`} detail={item.faultDescription || item.notes || item.status}/>)}</Block> : null}
    </div>
  </details>
}

function Summary({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded-xl p-3 ${highlight ? 'bg-destructive/10' : 'bg-muted'}`}><span className={highlight ? 'text-destructive [&>svg]:size-5' : 'text-primary [&>svg]:size-5'}>{icon}</span><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</p></div>
}
function Block({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><span className="text-primary [&>svg]:size-4">{icon}</span>{title}</h3><div className="flex flex-col gap-2">{Array.isArray(children) && children.filter(Boolean).length === 0 ? <p className="text-sm text-muted-foreground">暂无记录</p> : (children || <p className="text-sm text-muted-foreground">暂无记录</p>)}</div></section>
}
function BillLine({ bill }: { bill: Row }) {
  const state = billState(bill.amount, bill.paidAmount, bill.dueDate, today())
  const tones = {
    '已结清': 'bg-primary/10 text-primary',
    '待付款': 'bg-chart-2/15 text-chart-2',
    '即将到期': 'bg-accent text-accent-foreground',
    '逾期': 'bg-destructive/10 text-destructive',
    '部分收款': 'bg-secondary text-secondary-foreground',
  } as const
  const outstanding = Math.max(0, num(bill.amount) - num(bill.paidAmount))
  return <div className="rounded-xl bg-muted p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-medium">{bill.billType} · 覆盖 {billCoverageLabel(bill.periodStart, bill.periodEnd)}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[state]}`}>{state}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">付款日 {day(bill.dueDate)} · 应收 {money(bill.amount)} · 已付 {money(bill.paidAmount)} · 待付 {money(outstanding)}</p>{bill.notes ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{bill.notes}</p> : null}</div>
}

function Line({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl bg-muted p-3"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
}
function Tag({ children, tone }: { children: React.ReactNode; tone?: 'primary' | 'destructive' }) {
  const cls = tone === 'primary' ? 'bg-primary/10 text-primary' : tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-background text-muted-foreground'
  return <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{children}</span>
}
