import { getAccessContext } from '@/lib/access'
import { listAuditLogs } from '@/lib/audit'

export default async function AuditLogsPage() {
  const access = await getAccessContext('系统设置')
  let logs: Awaited<ReturnType<typeof listAuditLogs>> = []
  let loadError = false
  try {
    logs = await listAuditLogs(access.userId)
  } catch {
    loadError = true
  }
  return <main className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
    <header><p className="text-sm font-medium text-primary">安全审计</p><h1 className="mt-1 text-2xl font-bold text-balance">操作日志</h1><p className="mt-1 text-sm text-muted-foreground">查看关键业务操作的人员、时间和影响对象，最近展示 100 条。</p></header>
    <section className="overflow-hidden rounded-xl border bg-card">
      {loadError&&<p className="border-b bg-muted p-4 text-sm text-foreground">操作日志暂时无法读取，请稍后刷新；其他业务功能不受影响。</p>}
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">时间</th><th className="p-3">操作员</th><th className="p-3">操作</th><th className="p-3">对象</th><th className="p-3">说明</th></tr></thead><tbody>{logs.map((log)=><tr key={log.id} className="border-t"><td className="whitespace-nowrap p-3">{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(log.createdAt)}</td><td className="p-3 font-medium">{log.actorName}</td><td className="p-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{log.action}</span></td><td className="p-3">{log.resourceType}{log.resourceId?` #${log.resourceId}`:''}</td><td className="p-3 text-muted-foreground">{log.summary}</td></tr>)}</tbody></table></div>
      <div className="divide-y md:hidden">{logs.map((log)=><article key={log.id} className="flex flex-col gap-2 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{log.action} · {log.resourceType}</p><time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(log.createdAt)}</time></div><p className="text-sm">{log.summary}</p><p className="text-xs text-muted-foreground">操作员：{log.actorName}</p></article>)}</div>
      {!logs.length&&<p className="p-12 text-center text-sm text-muted-foreground">暂无操作日志，后续关键业务操作会显示在这里。</p>}
    </section>
  </main>
}
