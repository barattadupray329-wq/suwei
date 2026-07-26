'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { getRentalById } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { toast } from 'sonner'

type Row = { id: number; orderType: string; lifecycleStatus: string; deletedAt: Date | null; contractNo: string; customerCompany: string | null; customerName: string; customerPhone: string; deviceName: string; quantity: number; startDate: string; endDate: string; totalRent: string; paidAmount: string; outstandingAmount: string; overdueAmount: string; projectedAmount: string; projectedPeriodStart: string | null; projectedPeriodEnd: string | null; totalDueAmount: string; paymentStatus: string; status: string; assigneeName: string | null }
type Filters = { query: string; status: string; startDate: string; endDate: string; assignee: string; orderType: string; lifecycleStatus: string; sort: string; page: number }
type Assignee = { id: string; name: string; role: 'admin' | 'employee' }
type Access = { role: 'super_admin' | 'admin' | 'employee'; permissions: string[]; actorId: string; actorName: string }
type RentalDetail = Awaited<ReturnType<typeof getRentalById>>
const detailSummary = { total: 0, active: 0, draft: 0, overdue: 0, dueSoon: 0, repairPending: 0, revenue: '0', monthRevenue: '0', receivable: '0', currentDue: '0', overdue30: '0', overdue60: '0', overdue90: '0' }

const money = (value: string) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(Number(value))
const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - Date.now()) / 86_400_000)

function RentalHealth({ row }: { row: Row }) {
  const days = daysUntil(row.endDate)
  const overdue = Number(row.overdueAmount)
  return <div className="flex flex-col gap-1">
    <span className="w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{row.status}</span>
    <span className={`text-xs ${overdue > 0 || days < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
      {overdue > 0 ? `逾期应收 ${money(row.overdueAmount)}` : days < 0 ? `已到期 ${Math.abs(days)} 天` : days === 0 ? '今天到期' : `剩余 ${days} 天`}
    </span>
  </div>
}

export function RentalRecords({ rows, total, totalDueAmount, page, pageCount, filters, assignees, access }: { rows: Row[]; total: number; totalDueAmount: string; page: number; pageCount: number; filters: Filters; assignees: Assignee[]; access: Access }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cache = useRef(new Map<number, NonNullable<RentalDetail>>())
  const [openingRentalId, setOpeningRentalId] = useState<number | null>(null)
  const [selectedRental, setSelectedRental] = useState<NonNullable<RentalDetail> | null>(null)
  const activeRentalId = searchParams.get('rental')
  useEffect(() => setOpeningRentalId(null), [activeRentalId])
  const detailHref = (id: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    params.set('rental', String(id))
    return `/rentals?${params.toString()}`
  }
  const loadDetail = async (id: number, showLoading = false) => {
    const cached = cache.current.get(id)
    if (cached) return cached
    if (showLoading) setOpeningRentalId(id)
    try {
      const detail = await getRentalById(id)
      if (detail) cache.current.set(id, detail)
      return detail
    } catch {
      return null
    } finally {
      if (showLoading) setOpeningRentalId(null)
    }
  }
  const openDetail = async (id: number) => {
    const cached = cache.current.get(id)
    if (cached) {
      setSelectedRental(cached)
    } else {
      const detail = await loadDetail(id, true)
      if (!detail) {
        toast.error('租赁详情加载失败，请重试')
        return
      }
      setSelectedRental(detail)
    }
    window.history.pushState(null, '', detailHref(id))
  }
  const closeDetail = () => {
    setSelectedRental(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('rental')
    window.history.replaceState(null, '', `/rentals${params.size ? `?${params}` : ''}`)
  }
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    Object.entries({ ...filters, page: nextPage }).forEach(([key, value]) => {
      if (value && value !== '全部' && value !== 'newest') params.set(key, String(value))
    })
    return `/rentals?${params}`
  }

  return <div className="page-container">
    {openingRentalId !== null && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium shadow-lg" role="status" aria-live="polite">
      <LoaderCircle className="size-4 animate-spin text-primary" />
      正在打开详情…
    </div>}
    <header className="page-header">
      <div><p className="page-eyebrow">合同全生命周期</p><h1 className="page-title">租赁管理</h1><p className="page-description">统一办理租赁业务，并直接掌握每份合同的待收、逾期与到期风险。</p></div>
      <div className="page-actions"><Link href="/rentals/trash" className="secondary-button">回收站</Link><a href={`/api/exports/rental-ledger?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== '全部').map(([key, value]) => [key, String(value)]))}`} className="secondary-button"><Download className="size-4"/>按条件导出</a><Link href="/rentals?new=1" className="primary-button"><Plus className="size-4"/>登记新租赁</Link></div>
    </header>

    <form className="surface" action="/rentals" method="get"><div className="surface-content grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="xl:col-span-2"><span className="sr-only">搜索合同或客户</span><span className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><input name="query" defaultValue={filters.query} placeholder="合同号、客户、手机号、设备" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"/></span></label>
      <select name="orderType" defaultValue={filters.orderType} aria-label="订单类型" className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="all">全部类型</option><option value="official">正式合同</option><option value="draft">草稿</option><option value="test">测试合同</option></select>
      <select name="status" defaultValue={filters.status} aria-label="合同状态" className="h-10 rounded-lg border bg-background px-3 text-sm"><option>全部</option>{['在租','逾期','部分买断','部分退租','部分丢失','已完成','已买断'].map((item) => <option key={item}>{item}</option>)}</select>
      <select name="assignee" defaultValue={filters.assignee} aria-label="维护负责人" className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="">全部负责人</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <input type="date" name="startDate" defaultValue={filters.startDate} aria-label="起租日期起" className="h-10 rounded-lg border bg-background px-3 text-sm"/>
      <input type="date" name="endDate" defaultValue={filters.endDate} aria-label="到期日期止" className="h-10 rounded-lg border bg-background px-3 text-sm"/>
      <select name="sort" defaultValue={filters.sort} aria-label="排序方式" className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="newest">最新录入</option><option value="oldest">最早录入</option><option value="due">即将到期</option><option value="amount">合同金额</option></select>
      <div className="flex gap-2 xl:col-span-5"><button className="primary-button" type="submit"><SlidersHorizontal className="size-4"/>应用筛选</button><Link href="/rentals" className="secondary-button">清空</Link></div>
    </div></form>

    <section className="data-shell"><div className="toolbar"><div><h2 className="font-semibold">查询结果</h2><p className="text-sm text-muted-foreground">共 {total.toLocaleString('zh-CN')} 条，当前第 {page} / {pageCount} 页</p></div></div>
      {rows.length ? <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">合同与客户</th><th className="p-3">设备</th><th className="p-3">租期</th><th className="p-3">金额进度</th><th className="p-3">风险状态</th><th className="p-3">负责人</th><th className="p-3 text-right">操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onDoubleClick={() => openDetail(row.id)} title="双击查看租赁详情" className="cursor-pointer border-t hover:bg-muted/40">
          <td className="p-3"><p className="flex flex-wrap items-center gap-2 font-semibold">{row.contractNo}<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{row.orderType === 'official' ? '正式' : row.orderType === 'draft' ? '草稿' : '测试'}</span></p><p>{row.customerCompany || row.customerName}</p><p className="text-xs text-muted-foreground">{row.customerName} · {row.customerPhone}</p></td>
          <td className="p-3">{row.deviceName}<p className="text-xs text-muted-foreground">共 {row.quantity} 台</p></td>
          <td className="p-3">{row.startDate}<p className="text-xs text-muted-foreground">至 {row.endDate}</p></td>
          <td className="p-3"><p className="font-semibold">合计待收 {money(row.totalDueAmount)}</p>{Number(row.outstandingAmount) > 0 && <p className="text-xs text-muted-foreground">现有欠款 {money(row.outstandingAmount)}</p>}{Number(row.projectedAmount) > 0 && <p className="text-xs font-medium text-primary">下一期应收 {money(row.projectedAmount)}<span className="block font-normal text-muted-foreground">预计 {row.projectedPeriodStart} 至 {row.projectedPeriodEnd}</span></p>}<p className="text-xs text-muted-foreground">合同 {money(row.totalRent)} · 已收 {money(row.paidAmount)}</p></td>
          <td className="p-3"><RentalHealth row={row}/></td><td className="p-3">{row.assigneeName || '未分配'}</td><td className="p-3 text-right"><Link className="font-semibold text-primary hover:underline" href={detailHref(row.id)} onPointerEnter={() => void loadDetail(row.id)} onFocus={() => void loadDetail(row.id)} onClick={(event) => { event.preventDefault(); void openDetail(row.id) }} aria-label={`查看合同 ${row.contractNo} 详情`}>{openingRentalId === row.id ? '打开中…' : '查看详情'}</Link></td>
        </tr>)}</tbody></table></div>
        <div className="flex flex-col gap-3 p-3 md:hidden">{rows.map((row) => <article key={row.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.contractNo}</p><p className="text-sm">{row.customerCompany || row.customerName}</p></div><RentalHealth row={row}/></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">设备</p><p>{row.deviceName} · {row.quantity} 台</p></div><div><p className="text-muted-foreground">负责人</p><p>{row.assigneeName || '未分配'}</p></div><div><p className="text-muted-foreground">合计待收</p><p className="font-semibold">{money(row.totalDueAmount)}</p>{Number(row.projectedAmount) > 0 && <p className="text-xs text-primary">下一期 {money(row.projectedAmount)}</p>}</div><div><p className="text-muted-foreground">到期日</p><p>{row.endDate}</p>{row.projectedPeriodEnd && <p className="text-xs text-muted-foreground">预计续至 {row.projectedPeriodEnd}</p>}</div></div><Link href={detailHref(row.id)} onClick={(event) => { event.preventDefault(); void openDetail(row.id) }} className="secondary-button mt-4 w-full justify-center">{openingRentalId === row.id ? '打开中…' : '查看详情'}</Link></article>)}</div>
      </> : <div className="p-10 text-center text-muted-foreground">没有符合条件的租赁合同</div>}
      <footer className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">第 {total ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, total)} 条</p><p className="mt-1 font-semibold text-primary">合计待收 {money(totalDueAmount)} <span className="text-xs font-normal text-muted-foreground">（当前筛选全部合同）</span></p></div><div className="flex gap-2"><Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} href={pageHref(Math.max(1, page - 1))} className={`secondary-button ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}><ChevronLeft className="size-4"/>上一页</Link><Link aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : 0} href={pageHref(Math.min(pageCount, page + 1))} className={`secondary-button ${page >= pageCount ? 'pointer-events-none opacity-50' : ''}`}>下一页<ChevronRight className="size-4"/></Link></div></footer>
    </section>
    {selectedRental && <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={detailSummary} rentals={[selectedRental]} mode="management" detailsOnly onCloseDetails={closeDetail} />}
  </div>
}
