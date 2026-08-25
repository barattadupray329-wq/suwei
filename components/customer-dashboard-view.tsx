'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronRight, CircleUserRound, Eye, Layers, LogOut, Monitor, Phone, ReceiptText, Store, Wallet } from 'lucide-react'
import Link from 'next/link'
import { formatDeviceConfig, getDeviceConfigSummary } from '@/lib/device-config'
import type { getCustomerActiveRentals } from '@/lib/customer-phone-auth'

export type CustomerDashboardData = NonNullable<Awaited<ReturnType<typeof getCustomerActiveRentals>>>
type Contract = CustomerDashboardData['contracts'][number]
type RentalItem = CustomerDashboardData['items'][number]

const money = (value: string) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value))
const outstanding = (contract: Contract) => Math.max(0, Number(contract.totalRent) - Number(contract.paidAmount))
const statusTone = (status: string) => status === '逾期' ? 'border-destructive/30 bg-destructive/10 text-destructive' : status === '即将到期' ? 'border-accent/40 bg-accent/15 text-foreground' : 'border-primary/30 bg-primary/10 text-primary'

// mode="live"：客户本人通过短信验证码登录后看到的真实页面（/customer）。
// mode="preview"：商家在「客户服务」后台里以只读预览方式查看同一份数据和同一套排版，
// 用来确认客户登录后到底能看到什么，而不需要客户提供验证码。两种模式渲染逻辑完全一致，
// 唯一区别是顶部导航——预览模式下没有真实登录会话，因此隐藏「退出」按钮，改为提示条。
export function CustomerDashboardView({ data, mode = 'live' }: { data: CustomerDashboardData; mode?: 'live' | 'preview' }) {
  // 合同列表默认只展示一行摘要（台数/是否到期/待付款/简要配置），点某一行才弹出完整明细，
  // 避免像手风琴逐条展开那样占用大量竖向空间，客户扫一眼列表就能看懂整体情况。
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const maskedPhone = `${data.phone.slice(0, 3)}****${data.phone.slice(-4)}`
  const itemsFor = (contractId: number) => data.items.filter((item) => item.rentalId === contractId)
  const summaryFor = (contract: Contract) => {
    const items = itemsFor(contract.id)
    const totalQty = items.length ? items.reduce((sum, item) => sum + item.quantity, 0) : contract.quantity
    // 按设备类型分别汇总数量，而不是"设备名、设备名 · 共2台"——混租多种设备时看不出
    // 具体是几台台式机、几台显示器，展示成"台式机×1、显示器×1"更直观。
    const typeQuantities = new Map<string, number>()
    for (const item of items) typeQuantities.set(item.deviceType, (typeQuantities.get(item.deviceType) ?? 0) + item.quantity)
    const deviceBreakdown = typeQuantities.size
      ? Array.from(typeQuantities.entries()).map(([type, qty]) => `${type}×${qty}`).join('、')
      : `${contract.deviceName}×${contract.quantity}`
    const configSummary = items.length ? getDeviceConfigSummary(items[0]) : getDeviceConfigSummary(contract)
    return { items, totalQty, deviceBreakdown, configSummary }
  }

  const totalDevices = data.contracts.reduce((sum, contract) => sum + summaryFor(contract).totalQty, 0)
  const totalOutstanding = data.contracts.reduce((sum, contract) => sum + outstanding(contract), 0)
  const dueSoonCount = data.contracts.filter((contract) => contract.status === '即将到期' || contract.status === '逾期').length
  const selectedContract = data.contracts.find((contract) => contract.id === selectedId) ?? null

  return <main className="min-h-svh bg-background pb-10">
    {mode === 'preview' && <div className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-center text-sm font-medium text-foreground"><Eye className="size-4" />以下画面与客户登录后看到的内容完全一致（只读预览）</div>}
    <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3"><Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="size-4" />返回官网</Link>{mode === 'live' ? <form action="/api/customer-auth/logout" method="post"><button aria-label="退出客户登录" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><LogOut className="size-4" />退出</button></form> : <span className="rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground">预览模式</span>}</nav>

    <header className="bg-primary px-4 pb-8 pt-7 text-primary-foreground">
      <div className="mx-auto max-w-4xl">
        <p className="flex items-center gap-2 text-sm opacity-80"><Store className="size-4" />{data.shopName}</p>
        <h1 className="mt-2 text-balance text-3xl font-bold">{data.customerName}，您好</h1>
        <p className="mt-2 text-sm opacity-80">已验证手机号 {maskedPhone} · 本页仅展示您本人的在租信息，无法修改</p>
      </div>
    </header>

    <div className="mx-auto -mt-5 flex max-w-4xl flex-col gap-5 px-4">
      {/* 一眼看清核心情况：租了多少台、要付多少钱、有没有要到期的合同 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={ReceiptText} label="在租合同" value={`${data.contracts.length} 份`} />
        <StatCard icon={Monitor} label="在租设备" value={`${totalDevices} 台`} />
        <StatCard icon={Wallet} label="待支付金额" value={money(String(totalOutstanding))} tone={totalOutstanding > 0 ? 'destructive' : 'primary'} />
        <StatCard icon={AlertTriangle} label="到期提醒" value={dueSoonCount > 0 ? `${dueSoonCount} 份需关注` : '暂无提醒'} tone={dueSoonCount > 0 ? 'accent' : 'muted'} />
      </section>

      {data.assignee && <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3"><CircleUserRound className="size-5 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">客户负责人</p><p className="text-sm font-medium">{data.assignee.name}</p></div></div>
        {data.assignee.phone ? <a className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-primary" href={`tel:${data.assignee.phone}`}><Phone className="size-4" />{data.assignee.phone}</a> : <p className="text-sm text-muted-foreground">联系电话暂未设置</p>}
      </article>}

      {/* 紧凑列表：每份合同一行，扫一眼就能看清台数/到期状态/待付款，点击整行才弹出完整明细 */}
      {data.contracts.length ? <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col divide-y">
          {data.contracts.map((contract) => {
            const { deviceBreakdown, configSummary } = summaryFor(contract)
            const owed = outstanding(contract)
            return <button key={contract.id} type="button" onClick={() => setSelectedId(contract.id)} className="flex items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{contract.contractNo}</span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(contract.status)}`}>{contract.status}</span></div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{deviceBreakdown}{configSummary ? ` · ${configSummary}` : ''}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">至 {contract.endDate} 到期</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="text-right"><p className="text-[11px] text-muted-foreground">{owed > 0 ? '待支付' : '付款状态'}</p><p className={`text-sm font-bold ${owed > 0 ? 'text-destructive' : 'text-primary'}`}>{owed > 0 ? money(String(owed)) : contract.paymentStatus}</p></div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </button>
          })}
        </div>
      </section> : <section className="rounded-2xl border border-dashed bg-card p-10 text-center"><Monitor className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">暂无当前在租信息</h2><p className="mt-2 text-sm text-muted-foreground">已退租或已结束的合同不会在这里显示。</p></section>}
    </div>

    {/* 点击某一行后打开的完整明细：不是弹窗浮层，而是整块顶替当前内容的详情页（类似手机端"点进去看"的
        钻取导航），避免在已经是预览弹窗的场景里出现"弹窗叠弹窗"的悬浮卡片。 */}
    {selectedContract && <ContractDetailPage contract={selectedContract} items={itemsFor(selectedContract.id)} onClose={() => setSelectedId(null)} />}
  </main>
}

function ContractDetailPage({ contract, items, onClose }: { contract: Contract; items: RentalItem[]; onClose: () => void }) {
  // 挂载后一帧再把 translate-y-full 去掉，形成从底部滑入的过渡；关闭时先滑出再真正卸载，
  // 这样整块详情页顶替内容区，而不是悬浮在页面正中间的独立卡片。
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
    }
  }, [])
  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 200)
  }
  return <div className={`fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background transition-transform duration-200 ease-out ${entered && !closing ? 'translate-y-0' : 'translate-y-full'}`}>
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <button type="button" aria-label="返回列表" onClick={handleClose} className="shrink-0 rounded-full border p-2 text-muted-foreground"><ArrowLeft className="size-4" /></button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold">合同 {contract.contractNo}</h2><span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(contract.status)}`}>{contract.status}</span></div><p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{contract.startDate} 至 {contract.endDate}</p></div>
    </div>
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="月租金" value={money(contract.monthlyRent)} /><Summary label="合同总额" value={money(contract.totalRent)} /><Summary label="已支付" value={money(contract.paidAmount)} /><Summary label="押金" value={money(contract.deposit)} /></div>
      <section className="mt-4 flex flex-col gap-3"><h3 className="flex items-center gap-2 font-semibold"><Layers className="size-4 text-primary" />设备明细</h3>{items.length ? items.map((item) => <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.deviceName}</p><p className="mt-1 text-sm text-muted-foreground">{item.deviceType}{item.deviceCode ? ` · 设备编号 ${item.deviceCode}` : ''}</p></div><span className="rounded-lg bg-muted px-2 py-1 text-sm">× {item.quantity}</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{formatDeviceConfig(item) || '配置详情请联系负责人'}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>租期：{item.startDate || contract.startDate} 至 {item.endDate || contract.endDate}</span><span>月租：{money(item.monthlyRent)}</span><span>合计：{money(item.totalRent)}</span></div></div>) : <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="font-medium">{contract.deviceName} · {contract.deviceType} · 共 {contract.quantity} 台</p></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{formatDeviceConfig(contract) || '配置详情请联系负责人'}</p></div>}</section>
      {contract.notes ? <footer className="mt-4 flex items-start gap-2 rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground"><ReceiptText className="mt-0.5 size-4 shrink-0" /><span>{contract.notes}</span></footer> : null}
    </div>
  </div>
}

function StatCard({ icon: Icon, label, value, tone = 'default' }: { icon: typeof Monitor; label: string; value: string; tone?: 'default' | 'destructive' | 'accent' | 'primary' | 'muted' }) {
  const valueTone = tone === 'destructive' ? 'text-destructive' : tone === 'accent' ? 'text-foreground' : tone === 'primary' ? 'text-primary' : tone === 'muted' ? 'text-muted-foreground' : 'text-foreground'
  return <article className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" />{label}</div><p className={`mt-2 text-lg font-bold text-balance ${valueTone}`}>{value}</p></article>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div> }
