import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getFinanceData } from '@/app/actions/business'
import { FinanceLedger } from '@/components/finance-ledger'
import { getAccessContext } from '@/lib/access'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await getAccessContext('资金查看')
  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] : ''
  const filters = { query: value('query'), type: value('type'), method: value('method'), from: value('from'), to: value('to'), page: Math.max(1, Number(value('page')) || 1), pageSize: 20 }
  const data = await getFinanceData(filters)
  const href = (page: number) => { const next = new URLSearchParams(); Object.entries({ ...filters, page }).forEach(([key, item]) => { if (item && key !== 'pageSize') next.set(key, String(item)) }); return `/finance?${next}` }
  return <><FinanceLedger data={data} filters={{ query: filters.query, type: filters.type || '全部', method: filters.method || '全部', from: filters.from, to: filters.to }}/><nav aria-label="资金流水分页" className="mx-auto -mt-20 mb-6 flex max-w-[1400px] items-center justify-between px-4 md:px-6"><p className="text-sm text-muted-foreground">共 {data.total.toLocaleString('zh-CN')} 笔 · 第 {data.page}/{data.pageCount} 页</p><div className="flex gap-2"><Link href={href(Math.max(1,data.page-1))} className={`secondary-button ${data.page <= 1 ? 'pointer-events-none opacity-50' : ''}`}><ChevronLeft className="size-4"/>上一页</Link><Link href={href(Math.min(data.pageCount,data.page+1))} className={`secondary-button ${data.page >= data.pageCount ? 'pointer-events-none opacity-50' : ''}`}>下一页<ChevronRight className="size-4"/></Link></div></nav></>
}
