'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Banknote, BookOpenCheck, ChevronRight, ClipboardList, FileSearch, Globe2, HardDriveDownload, LayoutDashboard, LogOut, Menu, Monitor, Palette, QrCode, UserRoundCog, X } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

type ShellProps = { children: ReactNode; storeName: string; userName: string; role: 'super_admin' | 'admin' | 'employee'; permissions: string[] }
type NavItem = { href: string; label: string; description: string; icon: typeof LayoutDashboard; permission?: string; superAdminOnly?: boolean; managerOnly?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const groups: NavGroup[] = [
  { label: '日常经营', items: [
    { href: '/dashboard', label: '经营总览', description: '指标、待办与最近合同', icon: LayoutDashboard, permission: '租赁操作' },
    { href: '/rentals', label: '租赁记录', description: '检索、筛选与合同操作', icon: FileSearch, permission: '租赁操作' },
    { href: '/finance', label: '资金流水', description: '收款、退款与应收', icon: Banknote, permission: '资金查看' },
    { href: '/customer-portals', label: '客户服务', description: '查询入口与授权', icon: QrCode, permission: '合同管理' },
  ] },
  { label: '团队与配置', items: [
    { href: '/accounts', label: '账号与权限', description: '员工账号和职责', icon: UserRoundCog, permission: '账号管理', managerOnly: true },
    { href: '/settings', label: '业务设置', description: '门店、合同与外观', icon: Palette, permission: '系统设置' },
    { href: '/website-packages', label: '官网方案', description: '公开租赁套餐', icon: Globe2, superAdminOnly: true },
  ] },
  { label: '安全与帮助', items: [
    { href: '/audit-logs', label: '业务记录', description: '关键操作可追溯', icon: ClipboardList, permission: '系统设置' },
    { href: '/backup', label: '数据备份', description: '备份、下载与恢复', icon: HardDriveDownload, permission: '系统设置' },
    { href: '/guide', label: '项目说明书', description: '按场景查看操作方法', icon: BookOpenCheck, permission: '租赁操作' },
  ] },
]

export function AppShell({ children, storeName, userName, role, permissions }: ShellProps) {
  const pathname = usePathname(); const router = useRouter(); const [mobileMenu, setMobileMenu] = useState(false); const [signingOut, setSigningOut] = useState(false)
  const can = (permission?: string) => !permission || permissions.includes(permission)
  const visibleGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => (!item.superAdminOnly || role === 'super_admin') && (!item.managerOnly || role !== 'employee') && can(item.permission)) })).filter((group) => group.items.length)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const publicRoute = pathname === '/' || pathname === '/customer' || pathname === '/customer-login' || pathname.startsWith('/portal/')
  const current = visibleGroups.flatMap((group) => group.items).find((item) => isActive(item.href))

  useEffect(() => {
    if (role !== 'admin' || publicRoute) return
    const marker = `suwei-daily-backup:${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())}`
    if (sessionStorage.getItem(marker)) return
    const controller = new AbortController()
    void fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'daily' }), signal: controller.signal }).then(async (response) => { const payload = await response.json().catch(() => null) as { error?: string } | null; if (!response.ok) throw new Error(payload?.error || '自动备份失败'); sessionStorage.setItem(marker, 'done') }).catch((error) => { if (error instanceof Error && error.name !== 'AbortError') toast.error('今日自动备份未完成，可前往数据备份手动创建') })
    return () => controller.abort()
  }, [role, publicRoute])

  const safeSignOut = async () => { if (signingOut) return; setSigningOut(true); try { const result = await authClient.signOut(); if (result.error) throw new Error(); router.replace('/sign-in'); router.refresh() } catch { toast.error('退出登录失败，请检查网络后重试'); setSigningOut(false) } }
  if (publicRoute || pathname.startsWith('/contracts/')) return children

  const navigation = (mobile = false) => <nav aria-label={mobile ? '手机功能菜单' : '后台主导航'} className="flex flex-col gap-5">
    {visibleGroups.map((group) => <section key={group.label}><p className="mb-2 px-3 text-xs font-semibold text-muted-foreground">{group.label}</p><div className="flex flex-col gap-1">{group.items.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} onClick={mobile ? () => setMobileMenu(false) : undefined} className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${isActive(href) ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`} aria-current={isActive(href) ? 'page' : undefined}><Icon className="size-5 shrink-0"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span>{mobile && <span className={`mt-0.5 block text-xs ${isActive(href) ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{description}</span>}</span>{mobile && <ChevronRight className="size-4 opacity-60"/>}</Link>)}</div></section>)}
  </nav>

  return <div className="min-h-svh bg-background">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="打开全部功能" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)} className="icon-button md:hidden"><Menu/></button><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Monitor className="size-5"/></span><div className="min-w-0"><p className="truncate font-bold">{storeName}</p><p className="truncate text-xs text-muted-foreground">{current?.label || '租赁业务管理中心'}</p></div></div>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-semibold">{userName}</p><p className="text-xs text-muted-foreground">{role === 'super_admin' ? '超级管理员' : role === 'admin' ? '管理员' : '员工账号'}</p></div><button type="button" aria-label="退出登录" title="退出登录" disabled={signingOut} onClick={safeSignOut} className="icon-button"><LogOut/></button></div>
    </header>
    {mobileMenu && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="关闭菜单" className="absolute inset-0 bg-foreground/35" onClick={() => setMobileMenu(false)}/><aside className="absolute inset-y-0 left-0 flex w-[min(88vw,340px)] flex-col bg-card shadow-xl"><div className="flex items-center justify-between border-b p-4"><div><p className="font-bold">全部功能</p><p className="text-xs text-muted-foreground">{userName} · {role === 'employee' ? '员工账号' : '管理员'}</p></div><button type="button" aria-label="关闭菜单" onClick={() => setMobileMenu(false)} className="icon-button"><X/></button></div><div className="flex-1 overflow-y-auto p-4">{navigation(true)}</div></aside></div>}
    <div className="flex pb-16 md:pb-0"><aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-64 shrink-0 self-start flex-col overflow-y-auto border-r bg-card p-4 md:flex"><div className="flex-1">{navigation()}</div><Link href="/guide" className="mt-6 rounded-xl bg-muted p-3 hover:bg-border"><p className="text-xs font-semibold">第一次使用？</p><p className="mt-1 text-xs leading-5 text-muted-foreground">打开项目说明书，按业务场景逐步操作。</p></Link></aside><main className="min-w-0 flex-1">{children}</main></div>
    <nav aria-label="手机快捷导航" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">{visibleGroups[0]?.items.slice(0, 3).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${isActive(href) ? 'text-primary' : 'text-muted-foreground'}`}><Icon className="size-5"/>{label}</Link>)}<button type="button" onClick={() => setMobileMenu(true)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"><Menu className="size-5"/>全部</button></nav>
  </div>
}
