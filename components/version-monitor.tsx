'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { usePathname } from 'next/navigation'
import { BUILD_VERSION } from '@/lib/build-version'
import { canAutoUpdate, shortVersion } from '@/lib/version-update'

type VersionPayload = { version: string; builtAt: string }

function pageSafety(lastActivity: number, dirty: boolean) {
  const active = document.activeElement
  return {
    idleFor: Date.now() - lastActivity,
    dirty,
    dialogOpen: Boolean(document.querySelector('[role="dialog"], [data-state="open"]')),
    inputFocused: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable),
    submitting: Boolean(document.querySelector('button[disabled][type="submit"], form[aria-busy="true"]')),
    visible: document.visibilityState === 'visible',
  }
}

export function VersionMonitor({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const [latest, setLatest] = useState<VersionPayload | null>(null)
  const [checking, setChecking] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const lastActivity = useRef(Date.now())
  const dirty = useRef(false)
  const refreshing = useRef(false)
  const hasUpdate = Boolean(latest && latest.version !== BUILD_VERSION)

  const refreshNow = useCallback((force = false) => {
    if (refreshing.current) return
    const safety = pageSafety(lastActivity.current, dirty.current)
    if (!force && !canAutoUpdate(safety)) return
    if (force && (safety.dirty || safety.dialogOpen || safety.inputFocused) && !window.confirm('当前页面可能有未提交内容，确认立即更新吗？')) return
    refreshing.current = true
    toast.loading('正在更新到最新版本…', { id: 'version-update' })
    window.setTimeout(() => window.location.reload(), 500)
  }, [])

  const check = useCallback(async (manual = false) => {
    if (checking) return
    setChecking(true)
    try {
      const response = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      if (!response.ok) throw new Error('版本检查失败')
      const payload = await response.json() as VersionPayload
      setLatest(payload)
      if (payload.version !== BUILD_VERSION) {
        setDismissed(false)
        window.setTimeout(() => refreshNow(false), 1500)
      } else if (manual) toast.success('当前已是最新版')
    } catch {
      if (manual) toast.error('暂时无法检查版本，请稍后重试')
    } finally {
      setChecking(false)
    }
  }, [checking, refreshNow])

  useEffect(() => {
    dirty.current = false
    lastActivity.current = Date.now()
  }, [pathname])

  useEffect(() => {
    const activity = () => { lastActivity.current = Date.now() }
    const markDirty = (event: Event) => { if (event.isTrusted && event.target instanceof Element && event.target.closest('form')) dirty.current = true }
    const clearDirty = () => { window.setTimeout(() => { dirty.current = false }, 1000) }
    const onVisibility = () => { if (document.visibilityState === 'visible') void check() }
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }))
    document.addEventListener('input', markDirty, true)
    document.addEventListener('change', markDirty, true)
    document.addEventListener('submit', clearDirty, true)
    document.addEventListener('reset', clearDirty, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    void check()
    const checkTimer = window.setInterval(() => void check(), 300_000)
    const updateTimer = window.setInterval(() => { if (hasUpdate) refreshNow(false) }, 10_000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, activity))
      document.removeEventListener('input', markDirty, true)
      document.removeEventListener('change', markDirty, true)
      document.removeEventListener('submit', clearDirty, true)
      document.removeEventListener('reset', clearDirty, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.clearInterval(checkTimer)
      window.clearInterval(updateTimer)
    }
  }, [check, hasUpdate, refreshNow])

  return <>
    <button type="button" onClick={() => void check(true)} disabled={checking} className={`flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground ${compact ? 'px-3 py-2' : 'mt-3 w-full rounded-lg border bg-background px-3 py-2.5'}`} title="点击检查更新">
      <RefreshCw className={`size-3.5 ${checking ? 'animate-spin' : ''}`} />
      <span>版本 {shortVersion(BUILD_VERSION)}</span>
    </button>
    {hasUpdate && !dismissed && <div role="status" className="fixed inset-x-3 top-20 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border border-primary/30 bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold">新版本已就绪</p><p className="mt-1 text-xs text-muted-foreground">空闲且没有未提交内容时会自动更新；当前操作不会被打断。</p></div>
      <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => refreshNow(true)} className="primary-button h-9 px-3 text-sm">立即更新</button><button type="button" onClick={() => setDismissed(true)} className="secondary-button h-9 px-3 text-sm">稍后</button><button type="button" aria-label="关闭更新提示" onClick={() => setDismissed(true)} className="icon-button size-9"><X className="size-4" /></button></div>
    </div>}
  </>
}
