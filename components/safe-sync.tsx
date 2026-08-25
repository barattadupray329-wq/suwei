'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type SyncState = { version: string; state: string; overdueReceivable: number; outstandingReceivable: number }
type SyncStatus = '已同步' | '正在同步' | '操作中，暂停更新' | '离线' | '待命'

const POLL_INTERVAL = 15_000
// 页面开着但用户 5 分钟内没有任何操作（鼠标/键盘/触摸/滚动）时，认为进入待命状态，
// 把轮询间隔拉长到 2 分钟，大幅降低数据库读取次数；一旦检测到任何操作，立即唤醒并
// 恢复到 15 秒的高频轮询，保证「有人在用」时依然能快速感知到别处的变更。
const IDLE_THRESHOLD = 5 * 60_000
const IDLE_POLL_INTERVAL = 2 * 60_000
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
  const usingIdleInterval = useRef(false)
  const wakeUp = useRef<() => void>(() => {})
  const [status, setStatus] = useState<SyncStatus>('已同步')
  const [displayVersion, setDisplayVersion] = useState(initialVersion)
  const [overdueReceivable, setOverdueReceivable] = useState<number | null>(null)
  const [outstandingReceivable, setOutstandingReceivable] = useState<number | null>(null)

  const protectedByOperator = useCallback(() => hasActiveWork() || Date.now() - lastInteraction.current < QUIET_PERIOD, [])

  useEffect(() => {
    const markInteraction = () => {
      lastInteraction.current = Date.now()
      // 当前轮询处于「待命」慢频状态时，任何操作都应立即唤醒并恢复到高频轮询，
      // 而不是等到下一次 2 分钟的慢周期才响应。
      if (usingIdleInterval.current) {
        usingIdleInterval.current = false
        wakeUp.current()
      }
    }
    const events: (keyof DocumentEventMap)[] = ['input', 'change', 'keydown', 'pointerdown', 'submit', 'mousemove', 'wheel', 'touchstart']
    events.forEach((event) => document.addEventListener(event, markInteraction, true))
    return () => events.forEach((event) => document.removeEventListener(event, markInteraction, true))
  }, [])

  useEffect(() => {
    if (pathname === '/sign-in' || pathname.startsWith('/portal/')) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const isIdleNow = () => Date.now() - lastInteraction.current >= IDLE_THRESHOLD
    const idleStatus = (operatorIsBusy: boolean) => (operatorIsBusy ? '操作中，暂停更新' : isIdleNow() ? '待命' : '已同步')
    const schedule = () => {
      // 用「即将调度的这一次」是否处于待命态来决定间隔：5 分钟无操作则降频到 2 分钟一次，
      // 有操作时保持 15 秒一次；markInteraction 里会在 usingIdleInterval 为 true 时立即唤醒。
      usingIdleInterval.current = isIdleNow()
      timer = setTimeout(check, usingIdleInterval.current ? IDLE_POLL_INTERVAL : POLL_INTERVAL)
    }
    const check = async () => {
      if (stopped) return
      if (document.hidden || !navigator.onLine) {
        setStatus(navigator.onLine ? idleStatus(false) : '离线')
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
          setStatus(idleStatus(operatorIsBusy))
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
            window.setTimeout(() => { refreshing.current = false; setStatus(idleStatus(false)) }, 1500)
          }
        } else {
          setStatus(idleStatus(operatorIsBusy))
        }
      } catch {
        setStatus(navigator.onLine ? idleStatus(false) : '离线')
      }
      schedule()
    }
    const wake = () => { clearTimeout(timer); check() }
    wakeUp.current = wake
    const onVisible = () => { if (!document.hidden) wake() }
    document.addEventListener('visibilitychange', onVisible)
    check()
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [pathname, protectedByOperator, router])

  const formatMoney = (amount: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: Math.round(amount * 100) % 100 ? 2 : 0, maximumFractionDigits: Math.round(amount * 100) % 100 ? 2 : 0 }).format(amount)
  return <div className="flex flex-col gap-1.5 text-[11px] leading-4 text-muted-foreground" aria-live="polite">{outstandingReceivable !== null && outstandingReceivable > 0 && <a href="/rentals?receivable=outstanding&sort=outstanding" className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/10"><span>待收总计</span><span>{formatMoney(outstandingReceivable)}</span></a>}{overdueReceivable !== null && overdueReceivable > 0 && <a href="/rentals?receivable=overdue&sort=outstanding" className="flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5 font-semibold text-destructive transition-colors hover:bg-destructive/10"><span>逾期待收</span><span>{formatMoney(overdueReceivable)}</span></a>}<div className="flex items-center justify-between gap-2"><span>{status}</span><span className="font-mono">v{displayVersion}</span></div></div>
}
