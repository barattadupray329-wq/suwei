'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Banknote, ClipboardList, Globe2, HardDriveDownload, LayoutDashboard, LogOut, Menu, Monitor, Palette, QrCode, UserRoundCog, X } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

type ShellProps = {
  children: ReactNode
  storeName: string
  userName: string
  role: 'super_admin' | 'admin' | 'employee'
  permissions: string[]
}

const items = [
  { href: '/dashboard', label: '经营总览', icon: LayoutDashboard, permission: '租赁操作' },
  { href: '/finance', label: '资金流水', icon: Banknote, permission: '资金查看' },
  { href: '/accounts', label: '账号管理', icon: UserRoundCog, permission: '账号管理' },
  { href: '/website-packages', label: '官网方案', icon: Globe2, superAdminOnly: true },
  { href: '/settings', label: '业务设置', icon: Palette, permission: '系统设置' },
  { href: '/customer-portals', label: '客户服务', icon: QrCode, permission: '合同管理' },
  { href: '/audit-logs', label: '业务记录', icon: ClipboardList, permission: '系统设置' },
  { href: '/backup', label: '数据备份', icon: HardDriveDownload, permission: '系统设置' },
]

export function AppShell({ children, storeName, userName, role, permissions }: ShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenu, setMobileMenu] = useState(false)
  const can = (permission?: string) => role === 'super_admin' || !permission || permissions.includes(permission)
  const visibleItems = items.filter((item) => (!item.superAdminOnly || role === 'super_admin') && can(item.permission))
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)
  const publicRoute = pathname === '/' || pathname === '/customer' || pathname === '/customer-login' || pathname.startsWith('/portal/')

  const safeSignOut = async () => {
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  if (publicRoute || pathname.startsWith('/contracts/')) return children

  const navigation = (mobile = false) => <nav aria-label={mobile ? '手机功能菜单' : '后台主导航'} className="flex flex-col gap-1">
    {visibleItems.map(({ href, label, icon: Icon }, index) => <div key={href}>{index === 1 && <p className="mb-2 mt-4 px-3 text-xs font-semibold text-muted-foreground">业务管理</p>}{index > 1 && visibleItems[index - 1]?.href === '/settings' && <p className="mb-2 mt-4 px-3 text-xs font-semibold text-muted-foreground">系统工具</p>}<Link href={href} onClick={mobile ? () => setMobileMenu(false) : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive(href) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted'}`} aria-current={isActive(href) ? 'page' : undefined}><Icon className="size-5 shrink-0" /><span className="flex-1">{label}</span>{isActive(href) && <span className="size-1.5 rounded-full bg-primary-foreground" />}</Link></div>)}
  </nav>

  return <div className="min-h-svh bg-background">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label="打开功能菜单" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)} className="rounded-lg border p-2 md:hidden"><Menu className="size-5" /></button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Monitor className="size-5" /></span>
        <div className="min-w-0"><p className="truncate font-semibold">{storeName}</p><p className="text-xs text-muted-foreground">租赁业务管理中心</p></div>
      </div>
      <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium">{userName}</p><p className="text-xs text-muted-foreground">{role === 'super_admin' ? '超级管理员' : role === 'admin' ? '管理员' : '员工账号'}</p></div><button type="button" aria-label="退出登录" title="退出登录" onClick={safeSignOut} className="rounded-lg border p-2 hover:bg-muted"><LogOut className="size-5" /></button></div>
    </header>

    {mobileMenu && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="关闭功能菜单" className="absolute inset-0 bg-foreground/30" onClick={() => setMobileMenu(false)} /><aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card p-4 shadow-xl"><div className="flex items-center justify-between border-b pb-4"><div><p className="font-semibold">功能菜单</p><p className="text-xs text-muted-foreground">{userName} · {role === 'super_admin' ? '超级管理员' : role === 'admin' ? '管理员' : '员工账号'}</p></div><button type="button" aria-label="关闭功能菜单" onClick={() => setMobileMenu(false)} className="rounded-lg border p-2"><X className="size-5" /></button></div><div className="mt-4">{navigation(true)}</div></aside></div>}

    <div className="flex pb-20 md:pb-0">
      <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-60 shrink-0 self-start flex-col overflow-y-auto border-r bg-card p-4 md:flex"><div className="flex-1">{navigation()}</div><div className="mt-6 rounded-xl bg-muted p-3"><p className="text-xs font-semibold">速维租赁管理</p><p className="mt-1 text-xs leading-5 text-muted-foreground">系统每日自动保护业务数据。</p></div></aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>

    <nav aria-label="手机快捷导航" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_hsl(var(--foreground)/0.06)] md:hidden">
      {can('租赁操作') ? <Link href="/dashboard" className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`}><LayoutDashboard className="size-5" />经营总览</Link> : <span />}
      {can('资金查看') ? <Link href="/finance" className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${pathname.startsWith('/finance') ? 'text-primary' : 'text-muted-foreground'}`}><Banknote className="size-5" />资金流水</Link> : <span />}
      <button type="button" onClick={() => setMobileMenu(true)} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${!pathname.startsWith('/dashboard') && !pathname.startsWith('/finance') ? 'text-primary' : 'text-muted-foreground'}`}><Menu className="size-5" />全部功能</button>
    </nav>
  </div>
}
