'use client'

import { Fragment, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, FileUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDraftsAsOfficial, getDraftRentalDetail, moveRentalToTrash } from '@/app/actions/rentals'

type DraftRow = { id: number; contractNo: string; customerCompany: string | null; customerName: string; customerPhone: string; deviceName: string; quantity: number; startDate: string; endDate: string; totalRent: string; assigneeName: string | null }
type Detail = Awaited<ReturnType<typeof getDraftRentalDetail>>

export function DraftReview({ rows, total, page, pageCount }: { rows: DraftRow[]; total: number; page: number; pageCount: number }) {
  const router = useRouter()
  const [selected, setSelected] = useState<number[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail>(null)
  const [pending, start] = useTransition()

  const allSelected = rows.length > 0 && selected.length === rows.length
  const toggle = (id: number) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const toggleDetail = (id: number) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return }
    setExpanded(id)
    setDetail(null)
    start(async () => setDetail(await getDraftRentalDetail(id)))
  }

  const confirm = (ids: number[]) => {
    if (!ids.length) { toast.error('请先勾选要转正式的草稿'); return }
    if (!window.confirm(`确认将 ${ids.length} 份草稿转为正式合同？转正后会生成正式合同号与应收账单，且不能再删除。`)) return
    start(async () => {
      const result = await confirmDraftsAsOfficial(ids)
      if (!result.ok) { toast.error(result.message); return }
      const { succeeded, failed } = result.data!
      if (failed.length) toast.warning(`成功 ${succeeded.length} 份，失败 ${failed.length} 份：${failed[0].message}`)
      else toast.success(`已转为正式合同：${succeeded.map((item) => item.contractNo).join('、')}`)
      setSelected([])
      setExpanded(null)
      router.refresh()
    })
  }

  const discard = (row: DraftRow) => {
    if (!window.confirm(`将草稿 ${row.customerName} 移入回收站？回收站保留 30 天。`)) return
    start(async () => {
      try {
        await moveRentalToTrash(row.id, '草稿审核不通过')
        toast.success('草稿已移入回收站')
        setSelected((current) => current.filter((id) => id !== row.id))
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '操作失败')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="surface">
        <div className="surface-content flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">草稿审核</h1>
            <p className="text-sm text-muted-foreground">共 {total} 份待审核草稿，核对无误后转为正式合同。草稿不计入经营与财务数据。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/rentals/drafts/import" className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium"><FileUp className="size-4" />批量导入</Link>
            <button type="button" disabled={pending || !selected.length} onClick={() => confirm(selected)} className="primary-button disabled:opacity-50">
              {pending ? '处理中…' : `批量转正式（${selected.length}）`}
            </button>
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="surface-content">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无草稿。可在经营总览新建合同时保存为草稿，或使用批量导入。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-3"><label className="flex items-center gap-2"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.id))} /><span className="sr-only">全选</span></label></th>
                    <th className="p-3">客户</th>
                    <th className="p-3">设备</th>
                    <th className="p-3">租期</th>
                    <th className="p-3">金额</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-t align-top">
                        <td className="p-3"><label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /><span className="sr-only">选择 {row.customerName}</span></label></td>
                        <td className="p-3"><div className="font-medium">{row.customerCompany || row.customerName}</div><div className="text-xs text-muted-foreground">{row.customerName} · {row.customerPhone}</div></td>
                        <td className="p-3">{row.deviceName} × {row.quantity}</td>
                        <td className="p-3">{row.startDate} ~ {row.endDate}</td>
                        <td className="p-3">{Number(row.totalRent).toFixed(2)} 元</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => toggleDetail(row.id)} className="flex items-center gap-1 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium">
                              {expanded === row.id ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}明细
                            </button>
                            <button type="button" disabled={pending} onClick={() => confirm([row.id])} className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50">转正式</button>
                            <button type="button" disabled={pending} onClick={() => discard(row)} className="flex items-center gap-1 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"><Trash2 className="size-3.5" />删除</button>
                          </div>
                        </td>
                      </tr>
                      {expanded === row.id && (
                        <tr className="border-t bg-muted/40">
                          <td className="p-3" />
                          <td className="p-3" colSpan={5}>
                            {!detail || detail.id !== row.id ? <span className="text-xs text-muted-foreground">正在加载明细…</span> : (
                              <div className="flex flex-col gap-3 text-xs leading-relaxed">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  <span>计费方式：{detail.billingType === 'daily' ? '日租' : '月租'}</span>
                                  <span>租赁时长：{detail.duration}{detail.billingType === 'daily' ? ' 天' : ' 个月'}</span>
                                  <span>押金：{Number(detail.deposit).toFixed(2)} 元</span>
                                  <span>维护负责人：{detail.assigneeName || '未分配'}</span>
                                  <span>客户地址：{detail.customerAddress || '未填写'}</span>
                                  <span>起租原因：{detail.startDateReason || '当天起租'}</span>
                                  <span>月租金合计：{Number(detail.monthlyRent).toFixed(2)} 元</span>
                                  <span>录入人：{detail.sourceName || '—'}</span>
                                </div>
                                <table className="w-full min-w-[560px] text-left">
                                  <thead className="text-muted-foreground"><tr><th className="py-1">设备</th><th className="py-1">类型</th><th className="py-1">数量</th><th className="py-1">单价</th><th className="py-1">小计</th><th className="py-1">配置</th></tr></thead>
                                  <tbody>
                                    {detail.items.map((item) => (
                                      <tr key={item.id} className="border-t">
                                        <td className="py-1">{item.deviceName}</td>
                                        <td className="py-1">{item.deviceType}</td>
                                        <td className="py-1">{item.quantity}</td>
                                        <td className="py-1">{Number(item.monthlyRent).toFixed(2)}</td>
                                        <td className="py-1">{Number(item.totalRent).toFixed(2)}</td>
                                        <td className="py-1 text-muted-foreground">{[item.deviceConfig, item.screenSize].filter(Boolean).join(' / ') || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {detail.notes && <p className="whitespace-pre-line text-muted-foreground">备注：{detail.notes}</p>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-4 text-sm">
              {page > 1 && <Link href={`/rentals/drafts?page=${page - 1}`} className="rounded-lg border bg-background px-3 py-1.5">上一页</Link>}
              <span className="text-muted-foreground">第 {page} / {pageCount} 页</span>
              {page < pageCount && <Link href={`/rentals/drafts?page=${page + 1}`} className="rounded-lg border bg-background px-3 py-1.5">下一页</Link>}
            </nav>
          )}
        </div>
      </section>
    </div>
  )
}
