'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Banknote, FileText, LayoutDashboard, QrCode, Settings, X } from 'lucide-react'

type Workspace = { key: string; href: string; label: string; subtitle?: string; kind: 'page' | 'rental'; dirty?: boolean }
type RentalWorkspace = { id: number; href: string; contractNo: string; customerName: string; dirty?: boolean }

const GLOBAL_KEY = 'suwei-global-workspaces-v1'
const RENTAL_KEY = 'rental-workspaces-v1'
const FORM_PREFIX = 'rental-workspace-form-'
const pages: Record<string, { label: string; icon: typeof LayoutDashboard }> = {
  '/dashboard': { label: '经营总览', icon: LayoutDashboard },
  '/rentals': { label: '租赁管理', icon: FileText },
  '/finance': { label: '资金流水', icon: Banknote },
  '/customer-portals': { label: '客户服务', icon: QrCode },
  '/rentals/drafts': { label: '草稿审核', icon: FileText },
  '/accounts': { label: '账号与权限', icon: Settings },
  '/settings': { label: '业务设置', icon: Settings },
  '/website-packages': { label: '官网方案', icon: Settings },
  '/audit-logs': { label: '业务记录', icon: FileText },
  '/backup': { label: '数据备份', icon: FileText },
  '/guide': { label: '项目说明书', icon: FileText },
}

function read<T>(key: string, fallback: T): T { try { return JSON.parse(sessionStorage.getItem(key) || '') as T } catch { return fallback } }
function identity(item: Workspace) {
  if (item.kind !== 'rental') return item.key
  const contractNo = item.label.trim().toUpperCase()
  if (/^(HT|ZL|CZ)[A-Z0-9-]+$/.test(contractNo)) return `contract:${contractNo}`
  return `rental:${new URL(item.href, window.location.origin).searchParams.get('rental') || item.key.split(':')[1]}`
}
function unique(items: Workspace[]) { const seen = new Set<string>(); return items.filter((item) => { const key = identity(item); if (seen.has(key)) return false; seen.add(key); return true }) }
function save(items: Workspace[]) { sessionStorage.setItem(GLOBAL_KEY, JSON.stringify(unique(items).slice(-12))) }

export function WorkspaceTabs() {
  const pathname = usePathname(); const router = useRouter(); const searchParams = useSearchParams()
  const [items, setItems] = useState<Workspace[]>([]); const [loadingHref, setLoadingHref] = useState<string | null>(null); const [pending, startTransition] = useTransition()
  const refs = useRef(new Map<string, HTMLDivElement>())
  const query = searchParams.toString(); const href = `${pathname}${query ? `?${query}` : ''}`
  const rentalId = Number(searchParams.get('rental')) || null
  const pagePath = useMemo(() => Object.keys(pages).sort((a, b) => b.length - a.length).find((path) => pathname === path || pathname.startsWith(`${path}/`)), [pathname])
  const activeKey = rentalId ? `rental:${rentalId}` : pagePath ? `page:${pagePath}` : ''

  useEffect(() => {
    const sync = () => {
      const rentals = read<RentalWorkspace[]>(RENTAL_KEY, [])
      let next = unique(read<Workspace[]>(GLOBAL_KEY, []).map((item) => {
        if (item.kind !== 'rental') return item
        const id = Number(new URL(item.href, window.location.origin).searchParams.get('rental')) || Number(item.key.split(':')[1])
        const rental = rentals.find((entry) => entry.id === id)
        return rental ? { ...item, key: `rental:${rental.id}`, href: rental.href, label: rental.contractNo, subtitle: rental.customerName, dirty: rental.dirty } : item
      }))
      if (rentalId) {
        const rental = rentals.find((entry) => entry.id === rentalId)
        const current: Workspace = { key: activeKey, href, label: rental?.contractNo || `订单 ${rentalId}`, subtitle: rental?.customerName || '租赁订单', kind: 'rental', dirty: rental?.dirty }
        const same = next.findIndex((item) => item.key === activeKey || identity(item) === identity(current))
        next = unique(same < 0 ? [...next, current] : next.map((item, index) => index === same ? { ...item, ...current } : item))
      } else if (pagePath && pages[pagePath]) {
        const current: Workspace = { key: activeKey, href, label: pages[pagePath].label, kind: 'page' }
        const same = next.findIndex((item) => item.key === activeKey)
        next = same < 0 ? [...next, current] : next.map((item, index) => index === same ? { ...item, ...current } : item)
      }
      save(next); setItems(next)
    }
    sync(); window.addEventListener('rental-workspaces-change', sync); return () => window.removeEventListener('rental-workspaces-change', sync)
  }, [activeKey, href, pagePath, rentalId])

  useEffect(() => { items.forEach((item) => router.prefetch(item.href)) }, [items, router])
  useEffect(() => { setLoadingHref(null) }, [href])
  useEffect(() => { const node = refs.current.get(activeKey); const parent = node?.parentElement; if (node && parent) parent.scrollTo({ left: Math.max(0, node.offsetLeft - parent.clientWidth / 2 + node.clientWidth / 2), behavior: 'smooth' }) }, [activeKey])
  useEffect(() => { const value = sessionStorage.getItem(`suwei-scroll:${activeKey}`); const top = value === null ? 0 : Number(value); const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: Number.isFinite(top) ? Math.max(0, top) : 0, behavior: 'instant' }))); return () => cancelAnimationFrame(frame) }, [activeKey, href])

  const remember = () => { sessionStorage.setItem(`suwei-scroll:${activeKey}`, String(window.scrollY)) }
  const open = (item: Workspace) => { if (item.key === activeKey) return; remember(); setLoadingHref(item.href); router.prefetch(item.href); startTransition(() => router.push(item.href, { scroll: false })) }
  const close = (item: Workspace) => {
    if (item.dirty && !window.confirm('该窗口有未提交内容，确认关闭并放弃吗？')) return
    sessionStorage.removeItem(`suwei-scroll:${item.key}`)
    if (item.kind === 'rental') { const id = Number(item.key.split(':')[1]); sessionStorage.removeItem(`${FORM_PREFIX}${id}`); sessionStorage.removeItem(`rental-workspace-operation-${id}`); sessionStorage.setItem(RENTAL_KEY, JSON.stringify(read<RentalWorkspace[]>(RENTAL_KEY, []).filter((entry) => entry.id !== id))) }
    const index = items.findIndex((entry) => entry.key === item.key); const next = items.filter((entry) => entry.key !== item.key); save(next); setItems(next)
    if (item.key === activeKey) router.push(next[Math.min(index, next.length - 1)]?.href || '/dashboard', { scroll: false })
  }

  if (!items.length) return null
  return <nav aria-label="多窗口工作台" className="sticky top-16 z-20 border-b bg-card/95 px-3 py-2 backdrop-blur md:px-4"><div className="flex items-center gap-2 overflow-x-auto">{items.map((item) => {
    const active = item.key === activeKey; const loading = loadingHref === item.href && (pending || href !== item.href); const Icon = item.kind === 'rental' ? FileText : pages[item.key.replace('page:', '')]?.icon || Settings
    return <div key={item.key} ref={(node) => { if (node) refs.current.set(item.key, node); else refs.current.delete(item.key) }} className={`relative flex h-11 shrink-0 items-center overflow-hidden rounded-lg border transition-colors ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : loading ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
      <Link aria-current={active ? 'page' : undefined} href={item.href} prefetch onMouseEnter={() => router.prefetch(item.href)} onClick={(event) => { event.preventDefault(); open(item) }} className="flex h-full min-w-0 items-center gap-2 px-3"><Icon className={`size-4 shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`}/>{item.dirty && <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-primary-foreground' : 'bg-destructive'}`} aria-label="有未提交内容"/>}<span className="max-w-40 truncate text-sm font-semibold">{item.label}</span>{active && <span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs font-semibold">当前</span>}{loading && <span className="size-3 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-label="正在切换"/>}{item.subtitle && <span className={`hidden max-w-28 truncate text-xs sm:inline ${active ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{item.subtitle}</span>}</Link>
      <button type="button" aria-label={`关闭 ${item.label}`} onClick={() => close(item)} className={`mr-1 rounded-md p-1.5 ${active ? 'text-primary-foreground/75 hover:bg-primary-foreground/15 hover:text-primary-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}><X className="size-4"/></button>{active && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-foreground"/>}
    </div>
  })}</div></nav>
}
