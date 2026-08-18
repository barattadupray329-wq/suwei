'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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
function writeTabs(tabs: Tab[]) { sessionStorage.setItem(TABS_KEY, JSON.stringify(tabs.slice(-12))) }
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
  const searchParams = useSearchParams()
  const [tabs, setTabs] = useState<Tab[]>([])
  const query = searchParams.toString()
  const href = `${pathname}${query ? `?${query}` : ''}`
  const rentalId = Number(searchParams.get('rental')) || null
  const basePath = useMemo(() => Object.keys(pageMeta).sort((a, b) => b.length - a.length).find((path) => pathname === path || pathname.startsWith(`${path}/`)), [pathname])
  const activeKey = rentalId ? `rental:${rentalId}` : basePath ? `page:${basePath}` : ''

  useEffect(() => {
    const sync = () => {
      const saved = read<Tab[]>(TABS_KEY, [])
      const rentals = read<RentalTab[]>(RENTAL_KEY, [])
      let next = saved.map((tab) => {
        if (tab.kind !== 'rental') return tab
        const rental = rentals.find((item) => `rental:${item.id}` === tab.key)
        return rental ? { ...tab, href: rental.href, label: rental.contractNo, subtitle: rental.customerName, dirty: rental.dirty } : tab
      })
      if (rentalId) {
        const rental = rentals.find((item) => item.id === rentalId)
        const tab: Tab = { key: activeKey, href, label: rental?.contractNo || `订单 ${rentalId}`, subtitle: rental?.customerName || '租赁订单', kind: 'rental', dirty: rental?.dirty }
        next = [...next.filter((item) => item.key !== activeKey), tab]
        restoreRentalForm(rentalId)
      } else if (basePath && pageMeta[basePath]) {
        const tab: Tab = { key: activeKey, href, label: pageMeta[basePath].label, kind: 'page' }
        next = [...next.filter((item) => item.key !== activeKey), tab]
      }
      writeTabs(next)
      setTabs(next)
    }
    sync()
    window.addEventListener('rental-workspaces-change', sync)
    return () => window.removeEventListener('rental-workspaces-change', sync)
  }, [activeKey, basePath, href, rentalId])

  useEffect(() => {
    const saved = Number(sessionStorage.getItem(`suwei-scroll:${activeKey}`))
    if (Number.isFinite(saved) && saved > 0) window.requestAnimationFrame(() => window.scrollTo({ top: saved }))
  }, [activeKey])

  const close = (tab: Tab) => {
    if (tab.dirty && !window.confirm('该窗口有未提交内容，确认关闭并放弃吗？')) return
    if (tab.kind === 'rental') {
      const id = Number(tab.key.split(':')[1])
      sessionStorage.removeItem(`${SNAPSHOT_PREFIX}${id}`)
      sessionStorage.removeItem(`rental-workspace-operation-${id}`)
      sessionStorage.setItem(RENTAL_KEY, JSON.stringify(read<RentalTab[]>(RENTAL_KEY, []).filter((item) => item.id !== id)))
    }
    const next = tabs.filter((item) => item.key !== tab.key)
    writeTabs(next)
    setTabs(next)
    if (tab.key === activeKey) window.location.assign(next.at(-1)?.href || '/dashboard')
  }

  if (!tabs.length) return null
  return <nav aria-label="多窗口工作台" className="sticky top-16 z-20 border-b bg-card/95 px-3 py-2 backdrop-blur md:px-4">
    <div className="flex items-center gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        const Icon = tab.kind === 'rental' ? FileText : pageMeta[tab.key.replace('page:', '')]?.icon || PanelsTopLeft
        return <div key={tab.key} className={`flex h-10 shrink-0 items-center rounded-lg border transition-colors ${active ? 'border-primary bg-primary/10' : 'bg-background hover:bg-muted'}`}>
          <Link href={tab.href} prefetch={false} onClick={() => prepareWorkspaceSwitch(activeKey)} className="flex h-full min-w-0 items-center gap-2 px-3">
            <Icon className="size-4 shrink-0 text-primary" />
            {tab.dirty && <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label="有未提交内容" />}
            <span className="max-w-40 truncate text-sm font-semibold">{tab.label}</span>
            {tab.subtitle && <span className="hidden max-w-28 truncate text-xs text-muted-foreground sm:inline">{tab.subtitle}</span>}
          </Link>
          <button type="button" aria-label={`关闭 ${tab.label}`} onClick={() => close(tab)} className="mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"><X className="size-4" /></button>
        </div>
      })}
    </div>
  </nav>
}
