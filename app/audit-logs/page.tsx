import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getAccessContext } from '@/lib/access'
import { listAuditLogs } from '@/lib/audit'

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const access = await getAccessContext('系统设置')
  const page = Math.max(1, Number((await searchParams).page) || 1)
  let result: Awaited<ReturnType<typeof listAuditLogs>> = { rows: [], total: 0, page, pageCount: 1 }
  let loadError = false
  try { result = await listAuditLogs(access.userId, page, 20) } catch { loadError = true }
  const { rows: logs, total, pageCount } = result
  return <main className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
    <header><p className="text-sm font-medium text-primary">业务管理</p><h1 className="mt-1 text-2xl font-bold text-balance">业务操作记录</h1><p className="mt-1 text-sm text-muted-foreground">服务端分页展示关键业务轨迹，共 {total.toLocaleString('zh-CN')} 条记录。</p></header>
    <section className="overflow-hidden rounded-xl border bg-card">
      {loadError && <p className="border-b bg-muted p-4 text-sm text-foreground">操作日志暂时无法读取，请稍后刷新；其他业务功能不受影响。</p>}
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">时间</th><th className="p-3">操作员</th><th className="p-3">操作</th><th className="p-3">对象</th><th className="p-3">说明</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-t"><td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(log.createdAt)}</td><td className="p-3 font-medium">{log.actorName}</td><td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{log.action}</span></td><td className="p-3">{log.resourceType}{log.resourceId ? ` #${log.resourceId}` : ''}</td><td className="p-3 text-muted-foreground">{log.summary}</td></tr>)}</tbody></table></div>
      <div className="divide-y md:hidden">{logs.map((log) => <article key={log.id} className="flex flex-col gap-2 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{log.action} · {log.resourceType}</p><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(log.createdAt)}</time></div><p className="text-sm">{log.summary}</p><p className="text-xs text-muted-foreground">操作员：{log.actorName}</p></article>)}</div>
      {!logs.length && <p className="p-12 text-center text-sm text-muted-foreground">暂无业务操作记录。</p>}
      <footer className="flex items-center justify-between border-t p-4"><p className="text-sm text-muted-foreground">第 {page} / {pageCount} 页</p><div className="flex gap-2"><Link href={`/audit-logs?page=${Math.max(1,page-1)}`} aria-disabled={page <= 1} className={`secondary-button ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}><ChevronLeft className="size-4"/>上一页</Link><Link href={`/audit-logs?page=${Math.min(pageCount,page+1)}`} aria-disabled={page >= pageCount} className={`secondary-button ${page >= pageCount ? 'pointer-events-none opacity-50' : ''}`}>下一页<ChevronRight className="size-4"/></Link></div></footer>
    </section>
  </main>
}
