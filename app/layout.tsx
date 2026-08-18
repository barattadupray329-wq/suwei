import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { StaleBuildGuard } from '@/components/stale-build-guard'
import { getCurrentSession } from '@/lib/auth'
import { getAccessContext } from '@/lib/access'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
export const metadata: Metadata = { metadataBase: new URL('https://www.tuzhuzu.cn'), title: { default: '速维电脑租赁｜台式机、笔记本与显示器租赁', template: '%s' }, description: '面向电商、公司、个人和游戏工作室提供电脑设备租赁，以台式机为主，并提供笔记本、显示器和一体机，支持单台租用与批量部署。', applicationName: '速维电脑租赁', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: '速维租赁', statusBarStyle: 'default' }, icons: { apple: '/apple-touch-icon-v2.png' }, keywords: ['台式机租赁','电脑租赁','笔记本租赁','显示器租赁','一体机租赁','电商电脑租赁','公司电脑租赁','游戏工作室电脑租赁','龙岩电脑租赁','速维租赁'] }
export const viewport: Viewport = { themeColor: '#f5f7f6', width: 'device-width', initialScale: 1 }
export const dynamic = 'force-dynamic'
const APP_VERSION = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

async function AppFrame({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const session = requestHeaders.has('host') ? await getCurrentSession() : null
  if (!session?.user) return children
  try {
    const access = await getAccessContext()
    return <AppShell storeName={access.shopName} userName={session.user.name} role={access.role} permissions={access.permissions} version={APP_VERSION}>{children}</AppShell>
  } catch {
    return children
  }
}

function InitialLoading() {
  return <main className="flex min-h-screen items-center justify-center bg-background p-6" aria-busy="true" aria-label="正在加载"><div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm"><span className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden="true" /><span className="text-sm font-medium text-foreground">正在加载，请稍候</span></div></main>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN" className="bg-background" data-scroll-behavior="smooth"><body className={`${sans.variable} ${mono.variable} font-sans antialiased`}><StaleBuildGuard /><Suspense fallback={<InitialLoading />}><AppFrame>{children}</AppFrame></Suspense><Toaster richColors position="top-center" /></body></html>
}
