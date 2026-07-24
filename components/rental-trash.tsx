'use client'

import Link from 'next/link'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { permanentlyDeleteRental, restoreRental } from '@/app/actions/rentals'

type TrashRow = { id: number; orderType: string; contractNo: string; customerName: string; customerCompany: string | null; deviceName: string; totalRent: string; deletedAt: string | null; deletedBy: string | null; deleteReason: string | null; remainingDays: number }

export function RentalTrash({ rows }: { rows: TrashRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = (action: () => Promise<void>, message: string) => startTransition(async () => {
    try { await action(); toast.success(message); router.refresh() } catch (error) { toast.error(error instanceof Error ? error.message : '操作失败') }
  })
  return <div className="page-container">
    <header className="page-header"><div><p className="page-eyebrow">数据保护</p><h1 className="page-title">租赁回收站</h1><p className="page-description">草稿和测试合同移入后保留 30 天，可随时恢复。正式合同不会出现在这里。</p></div><Link href="/rentals" className="secondary-button">返回租赁记录</Link></header>
    <section className="data-shell">
      <div className="toolbar"><div><h2 className="font-semibold">待处理订单</h2><p className="text-sm text-muted-foreground">共 {rows.length} 条。彻底删除前会再次检查业务与资金关联记录。</p></div></div>
      {rows.length ? <div className="divide-y">{rows.map((row) => <article key={row.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{row.contractNo}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs">{row.orderType === 'draft' ? '草稿' : '测试'}</span></div><p className="mt-1 text-sm">{row.customerCompany || row.customerName} · {row.deviceName}</p><p className="mt-1 text-xs text-muted-foreground">删除于 {row.deletedAt ? new Date(row.deletedAt).toLocaleString('zh-CN') : '未知'} · 原因：{row.deleteReason || '未填写'} · 剩余 {row.remainingDays} 天</p></div>
        <div className="flex flex-wrap gap-2"><button disabled={pending} onClick={() => run(() => restoreRental(row.id), '订单已恢复')} className="secondary-button"><RotateCcw className="size-4"/>恢复</button><button disabled={pending} onClick={() => { if (window.confirm(`彻底删除 ${row.contractNo}？此操作无法恢复。`)) run(() => permanentlyDeleteRental(row.id), '订单已彻底删除') }} className="flex h-10 items-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"><Trash2 className="size-4"/>彻底删除</button></div>
      </article>)}</div> : <p className="p-12 text-center text-sm text-muted-foreground">回收站为空</p>}
    </section>
  </div>
}
