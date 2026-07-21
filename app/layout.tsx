import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { auth } from '@/lib/auth'
import { getAccessContext } from '@/lib/access'
import { getStoreName } from '@/app/actions/business'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
export const metadata: Metadata = { metadataBase: new URL('https://www.tuzhuzu.cn'), title: { default: '速维台式机租赁｜电商与游戏工作室电脑租赁', template: '%s' }, description: '面向电商团队、游戏工作室和个人提供台式电脑租赁，支持配置匹配、批量交付、灵活租期、设备维护与升级更换。', applicationName: '速维电脑租赁', keywords: ['台式机租赁','电脑主机租赁','电商工作室电脑租赁','游戏工作室电脑租赁','龙岩电脑租赁','速维租赁'] }
export const viewport: Viewport = { themeColor: '#f5f7f6', width: 'device-width', initialScale: 1 }
export const dynamic = 'force-dynamic'
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers()
  const hasRequestContext = requestHeaders.has('host')
  const session = hasRequestContext ? await auth.api.getSession({ headers: requestHeaders }) : null
  let content = children
  if (session?.user) {
    const [access, storeName] = await Promise.all([getAccessContext(), getStoreName()])
    content = <AppShell storeName={storeName} userName={session.user.name} role={access.role} permissions={access.permissions}>{children}</AppShell>
  }
  return <html lang="zh-CN" className="bg-background"><body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>{content}<Toaster richColors position="top-center" /></body></html>
}
