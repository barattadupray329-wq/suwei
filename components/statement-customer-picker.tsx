import Link from 'next/link'
import { Search } from 'lucide-react'
import type { StatementCustomer } from '@/app/actions/statements'

const money = (n: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

function buildHref(params: { phone?: string; q?: string; filter?: string }) {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.filter === 'all') search.set('filter', 'all')
  if (params.phone) search.set('phone', params.phone)
  const value = search.toString()
  return value ? `/statements?${value}` : '/statements'
}

export function StatementCustomerPicker({ customers, selectedPhone, query, filter }: { customers: StatementCustomer[]; selectedPhone: string; query: string; filter: 'unpaid' | 'all' }) {
  const keyword = query.trim().toLowerCase()
  const visible = customers.filter((customer) => {
    if (filter === 'unpaid' && customer.dueTotal <= 0 && customer.upcomingTotal <= 0 && customer.phone !== selectedPhone) return false
    if (!keyword) return true
    return [customer.phone, customer.company ?? '', ...customer.names].some((value) => value.toLowerCase().includes(keyword))
  })

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 lg:sticky lg:top-20 lg:max-h-[calc(100svh-7rem)] lg:w-80 print:hidden" aria-label="选择客户">
      <form action="/statements" className="flex gap-2">
        {filter === 'all' && <input type="hidden" name="filter" value="all" />}
        {selectedPhone && <input type="hidden" name="phone" value={selectedPhone} />}
        <label className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">搜索客户</span>
          <input name="q" defaultValue={query} placeholder="姓名 / 手机号 / 公司" className="h-9 w-full bg-transparent text-sm outline-none" />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">搜索</button>
      </form>
      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="客户范围">
        <Link role="tab" aria-selected={filter === 'unpaid'} href={buildHref({ q: query, phone: selectedPhone })} className={`flex-1 rounded-md py-1.5 text-center ${filter === 'unpaid' ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>有未付</Link>
        <Link role="tab" aria-selected={filter === 'all'} href={buildHref({ q: query, phone: selectedPhone, filter: 'all' })} className={`flex-1 rounded-md py-1.5 text-center ${filter === 'all' ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>全部客户</Link>
      </div>
      <p className="px-1 text-xs text-muted-foreground">共 {visible.length} 位客户（按手机号归并，已到期未付多的在前）</p>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {visible.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">没有匹配的客户</li>}
        {visible.map((customer) => {
          const active = customer.phone === selectedPhone
          const title = customer.company ? `${customer.company}（${customer.names.join('、')}）` : customer.names.join('、')
          return (
            <li key={customer.phone}>
              <Link
                href={buildHref({ q: query, filter, phone: customer.phone })}
                aria-current={active ? 'true' : undefined}
                className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{title || '未命名客户'}</span>
                  {customer.dueTotal > 0 ? <span className="shrink-0 font-semibold text-destructive">{money(customer.dueTotal)}</span> : <span className="shrink-0 text-xs text-muted-foreground">无到期欠款</span>}
                </span>
                <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{customer.phone} · {customer.contractCount} 份合同</span>
                  {customer.dueCount > 0 && <span>{customer.dueCount} 笔已到期</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
