'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type SyncState = { version: string; state: string; overdueReceivable: number; outstandingReceivable: number }
type SyncStatus = '已同步' | '正在同步' | '操作中，暂停更新' | '离线'

const POLL_INTERVAL = 15_000
const QUIET_PERIOD = 3_000

function hasActiveWork() {
  const active = document.activeElement
  const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active?.getAttribute('contenteditable') === 'true'
  const dialogOpen = Boolean(document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]'))
  const unsavedRental = document.documentElement.dataset.unsavedRental === 'true'
  const submitting = Boolean(document.querySelector('form[aria-busy="true"], button[aria-busy="true"], [data-submitting="true"]'))
  return editing || dialogOpen || unsavedRental || submitting
}

export function SafeSync({ initialVersion }: { initialVersion: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const baseline = useRef<SyncState | null>(null)
  const lastInteraction = useRef(Date.now())
  const refreshing = useRef(false)
  const [status, setStatus] = useState<SyncStatus>('已同步')
  const [displayVersion, setDisplayVersion] = useState(initialVersion)
  const [overdueReceivable, setOverdueReceivable] = useState<number | null>(null)
  const [outstandingReceivable, setOutstandingReceivable] = useState<number | null>(null)

  const protectedByOperator = useCallback(() => hasActiveWork() || Date.now() - lastInteraction.current < QUIET_PERIOD, [])

  useEffect(() => {
    const markInteraction = () => { lastInteraction.current = Date.now() }
    const events: (keyof DocumentEventMap)[] = ['input', 'change', 'keydown', 'pointerdown', 'submit']
    events.forEach((event) => document.addEventListener(event, markInteraction, true))
    return () => events.forEach((event) => document.removeEventListener(event, markInteraction, true))
  }, [])

  useEffect(() => {
    if (pathname === '/sign-in' || pathname.startsWith('/portal/')) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const schedule = () => { timer = setTimeout(check, POLL_INTERVAL) }
    const check = async () => {
      if (stopped) return
      if (document.hidden || !navigator.onLine) {
        setStatus(navigator.onLine ? '已同步' : '离线')
        schedule()
        return
      }
      try {
        const response = await fetch('/api/sync-state', { cache: 'no-store', headers: { Accept: 'application/json' } })
        if (!response.ok) { schedule(); return }
        const next = await response.json() as SyncState
        setOverdueReceivable(next.overdueReceivable)
        setOutstandingReceivable(next.outstandingReceivable)
        const operatorIsBusy = protectedByOperator()
        if (!baseline.current) {
          baseline.current = next
          setDisplayVersion(next.version)
          setStatus(operatorIsBusy ? '操作中，暂停更新' : '已同步')
        } else if ((next.state !== baseline.current.state || next.version !== baseline.current.version) && !refreshing.current) {
          if (next.version !== baseline.current.version) {
            // 发布版本升级必须优先于「正在编辑」判断：旧 JS 已经失效，继续停留只会在下次跳转时报错。
            // OpenNext 会把 APP_VERSION 内联进构建，因此这里能可靠识别版本变化。
            refreshing.current = true
            setStatus('正在同步')
            baseline.current = next
            setDisplayVersion(next.version)
            window.location.reload()
          } else if (operatorIsBusy) {
            setStatus('操作中，暂停更新')
          } else {
            refreshing.current = true
            setStatus('正在同步')
            baseline.current = next
            router.refresh()
            window.setTimeout(() => { refreshing.current = false; setStatus('已同步') }, 1500)
          }
        } else {
          setStatus(operatorIsBusy ? '操作中，暂停更新' : '已同步')
        }
      } catch {
        setStatus(navigator.onLine ? '已同步' : '离线')
      }
      schedule()
    }
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    check()
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [pathname, protectedByOperator, router])

  const formatMoney = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: Math.round(amount * 100) % 100 ? 2 : 0, maximumFractionDigits: Math.round(amount * 100) % 100 ? 2 : 0 }).format(amount)
  return <div className="flex flex-col gap-1.5 text-[11px] leading-4 text-muted-foreground" aria-live="polite">{outstandingReceivable !== null && outstandingReceivable > 0 && <a href="/rentals?receivable=outstanding&sort=outstanding" className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/10"><span>待收总计</span><span>{formatMoney(outstandingReceivable)}</span></a>}{overdueReceivable !== null && overdueReceivable > 0 && <a href="/rentals?receivable=overdue&sort=outstanding" className="flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/10"><span>逾期待收</span><span>{formatMoney(overdueReceivable)}</span></a>}<div className="flex items-center justify-between gap-2"><span>{status}</span><span className="font-mono">v{displayVersion}</span></div></div>
}
