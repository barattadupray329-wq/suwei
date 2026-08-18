'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Banknote, FileText, LayoutDashboard, List, PanelsTopLeft, X } from 'lucide-react'

const TABS_KEY = 'suwei-global-workspaces-v1'
const RENTAL_KEY = 'rental-workspaces-v1'
const SNAPSHOT_PREFIX = 'rental-workspace-form-'

type Tab = { key: string; href: string; label: string; subtitle?: string; kind: 'page' | 'rental'; dirty?: boolean }
type RentalTab = { id: number; contractNo: string; customerName: string; href: string; dirty?: boolean }
type Snapshot = Array<{ value: string; checked?: boolean }>

const pageMeta: Record<string, { label: string; icon: typeof LayoutDashboard }> = {
  '/dashboard': { label: '经营总览', icon: LayoutDashboard },
  '/rentals': { label: '租赁管理', icon: List },
  '/finance': { label: '资金流水', icon: Banknote },
  '/customer-portals': { label: '客户服务', icon: PanelsTopLeft },
  '/rentals/drafts': { label: '草稿审核', icon: FileText },
  '/accounts': { label: '账号与权限', icon: PanelsTopLeft },
  '/settings': { label: '业务设置', icon: PanelsTopLeft },
  '/website-packages': { label: '官网方案', icon: PanelsTopLeft },
  '/audit-logs': { label: '业务记录', icon: FileText },
  '/backup': { label: '数据备份', icon: FileText },
  '/guide': { label: '项目说明书', icon: FileText },
}

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(sessionStorage.getItem(key) || '') as T } catch { return fallback }
}
function rentalIdentity(tab: Tab) {
  if (tab.kind !== 'rental') return tab.key
  const contractNo = tab.label.trim().toUpperCase()
  if (/^(HT|ZL|CZ)[A-Z0-9-]+$/.test(contractNo)) return `contract:${contractNo}`
  const id = new URL(tab.href, window.location.origin).searchParams.get('rental') || tab.key.split(':')[1]
  return `rental:${id}`
}

function dedupeTabs(tabs: Tab[]) {
  const seen = new Set<string>()
  return tabs.filter((tab) => {
    const identity = rentalIdentity(tab)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function writeTabs(tabs: Tab[]) { sessionStorage.setItem(TABS_KEY, JSON.stringify(dedupeTabs(tabs).slice(-12))) }
function currentRentalId() { return Number(new URLSearchParams(window.location.search).get('rental')) || null }

export function prepareWorkspaceSwitch(activeKey?: string) {
  const key = activeKey || (currentRentalId() ? `rental:${currentRentalId()}` : `page:${window.location.pathname}`)
  sessionStorage.setItem(`suwei-scroll:${key}`, String(window.scrollY))
  return captureRentalForm()
}

function captureRentalForm() {
  const rentalId = currentRentalId()
  if (!rentalId) return false
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!dialog) return false
  const fields = Array.from(dialog.querySelectorAll('input, select, textarea')) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  if (!fields.length) return false
  const snapshot: Snapshot = fields.map((field) => ({ value: field.value, ...(field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) ? { checked: field.checked } : {}) }))
  sessionStorage.setItem(`${SNAPSHOT_PREFIX}${rentalId}`, JSON.stringify(snapshot))
  const rentals = read<RentalTab[]>(RENTAL_KEY, []).map((item) => item.id === rentalId ? { ...item, dirty: true } : item)
  sessionStorage.setItem(RENTAL_KEY, JSON.stringify(rentals))
  window.dispatchEvent(new Event('rental-workspaces-change'))
  return true
}

function restoreRentalForm(rentalId: number) {
  const snapshot = read<Snapshot>(`${SNAPSHOT_PREFIX}${rentalId}`, [])
  if (!snapshot.length) return
  window.setTimeout(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const fields = dialog ? Array.from(dialog.querySelectorAll('input, select, textarea')) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> : []
    fields.forEach((field, index) => {
      const saved = snapshot[index]
      if (!saved) return
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set?.call(field, saved.value)
      if (field instanceof HTMLInputElement && saved.checked !== undefined) field.checked = saved.checked
      field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }, 350)
}

export function GlobalWorkspaceTabs() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [isNavigating, startNavigation] = useTransition()
  const tabRefs = useRef(new Map<string, HTMLDivElement>())
  const query = searchParams.toString()
  const href = `${pathname}${query ? `?${query}` : ''}`
  const rentalId = Number(searchParams.get('rental')) || null
  const basePath = useMemo(() => Object.keys(pageMeta).sort((a, b) => b.length - a.length).find((path) => pathname === path || pathname.startsWith(`${path}/`)), [pathname])
  const activeKey = rentalId ? `rental:${rentalId}` : basePath ? `page:${basePath}` : ''

  useEffect(() => {
    const sync = () => {
      const saved = read<Tab[]>(TABS_KEY, [])
      const rentals = read<RentalTab[]>(RENTAL_KEY, [])
      let next = dedupeTabs(saved.map((tab) => {
        if (tab.kind !== 'rental') return tab
        const tabRentalId = Number(new URL(tab.href, window.location.origin).searchParams.get('rental')) || Number(tab.key.split(':')[1])
        const rental = rentals.find((item) => item.id === tabRentalId)
        return rental ? { ...tab, key: `rental:${rental.id}`, href: rental.href, label: rental.contractNo, subtitle: rental.customerName, dirty: rental.dirty } : tab
      }))
      if (rentalId) {
        const rental = rentals.find((item) => item.id === rentalId)
        const tab: Tab = { key: activeKey, href, label: rental?.contractNo || `订单 ${rentalId}`, subtitle: rental?.customerName || '租赁订单', kind: 'rental', dirty: rental?.dirty }
        const identity = rentalIdentity(tab)
        const existingIndex = next.findIndex((item) => item.key === activeKey || rentalIdentity(item) === identity)
        if (existingIndex === -1) next = [...next, tab]
        else next = next.map((item, index) => index === existingIndex ? { ...item, ...tab } : item)
        next = dedupeTabs(next)
        restoreRentalForm(rentalId)
      } else if (basePath && pageMeta[basePath]) {
        const tab: Tab = { key: activeKey, href, label: pageMeta[basePath].label, kind: 'page' }
        const existingIndex = next.findIndex((item) => item.key === activeKey)
        if (existingIndex === -1) next = [...next, tab]
        else next = next.map((item, index) => index === existingIndex ? { ...item, ...tab } : item)
      }
      writeTabs(next)
      setTabs(next)
    }
    sync()
    window.addEventListener('rental-workspaces-change', sync)
    return () => window.removeEventListener('rental-workspaces-change', sync)
  }, [activeKey, basePath, href, rentalId])

  useEffect(() => {
    tabs.forEach((tab) => router.prefetch(tab.href))
  }, [router, tabs])

  useEffect(() => {
    setPendingHref(null)
  }, [href])

  useEffect(() => {
    const tab = tabRefs.current.get(activeKey)
    const strip = tab?.parentElement
    if (!tab || !strip) return
    const left = Math.max(0, tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2)
    strip.scrollTo({ left, behavior: 'smooth' })
  }, [activeKey])

  useEffect(() => {
    const stored = sessionStorage.getItem(`suwei-scroll:${activeKey}`)
    const target = stored === null ? 0 : Number(stored)
    const top = Number.isFinite(target) ? Math.max(0, target) : 0
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeKey, href])

  const open = (tab: Tab) => {
    if (tab.key === activeKey) return
    prepareWorkspaceSwitch(activeKey)
    setPendingHref(tab.href)
    router.prefetch(tab.href)
    startNavigation(() => router.push(tab.href, { scroll: false }))
  }

  const close = (tab: Tab) => {
    if (tab.dirty && !window.confirm('该窗口有未提交内容，确认关闭并放弃吗？')) return
    sessionStorage.removeItem(`suwei-scroll:${tab.key}`)
    if (tab.kind === 'rental') {
      const id = Number(tab.key.split(':')[1])
      sessionStorage.removeItem(`${SNAPSHOT_PREFIX}${id}`)
      sessionStorage.removeItem(`rental-workspace-operation-${id}`)
      sessionStorage.setItem(RENTAL_KEY, JSON.stringify(read<RentalTab[]>(RENTAL_KEY, []).filter((item) => item.id !== id)))
    }
    const closingIndex = tabs.findIndex((item) => item.key === tab.key)
    const next = tabs.filter((item) => item.key !== tab.key)
    writeTabs(next)
    setTabs(next)
    if (tab.key === activeKey) {
      const adjacent = next[Math.min(closingIndex, next.length - 1)]
      router.push(adjacent?.href || '/dashboard', { scroll: false })
    }
  }

  if (!tabs.length) return null
  return <nav aria-label="多窗口工作台" className="workspace-tabs sticky top-16 z-20 border-b bg-card/95 px-3 py-2 backdrop-blur md:top-20 md:px-3 md:py-1.5">
    <div className="flex items-center gap-2 overflow-x-auto md:gap-1.5">
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        const pending = pendingHref === tab.href && (isNavigating || href !== tab.href)
        const Icon = tab.kind === 'rental' ? FileText : pageMeta[tab.key.replace('page:', '')]?.icon || PanelsTopLeft
        return <div ref={(node) => { if (node) tabRefs.current.set(tab.key, node); else tabRefs.current.delete(tab.key) }} key={tab.key} className={`relative flex h-11 shrink-0 items-center overflow-hidden rounded-lg border transition-colors md:h-10 md:rounded-md ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : pending ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
          <Link aria-current={active ? 'page' : undefined} href={tab.href} prefetch onMouseEnter={() => router.prefetch(tab.href)} onTouchStart={() => router.prefetch(tab.href)} onClick={(event) => { event.preventDefault(); open(tab) }} className="flex h-full min-w-0 items-center gap-2 px-3">
            <Icon className={`size-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
            {tab.dirty && <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-primary-foreground' : 'bg-destructive'}`} aria-label="有未提交内容" />}
            <span className="max-w-40 truncate text-sm font-semibold">{tab.label}</span>
            {active && <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-semibold">当前</span>}
            {pending && <span className="size-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-label="正在切换" />}
            {tab.subtitle && <span className={`hidden max-w-28 truncate text-xs sm:inline ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{tab.subtitle}</span>}
          </Link>
          <button type="button" aria-label={`关闭 ${tab.label}`} onClick={() => close(tab)} className={`mr-1 rounded-md p-1.5 ${active ? 'text-primary-foreground/75 hover:bg-primary-foreground/15 hover:text-primary-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}><X className="size-4" /></button>
          {active && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-foreground" />}
        </div>
      })}
    </div>
  </nav>
}
