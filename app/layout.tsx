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
export const metadata: Metadata = { metadataBase: new URL('https://www.tuzhuzu.cn'), title: { default: '速维电脑租赁｜台式机、笔记本与显示器租赁', template: '%s' }, description: '面向电商、公司、个人和游戏工作室提供电脑设备租赁，以台式机为主，并提供笔记本、显示器和一体机，支持单台租用与批量部署。', applicationName: '速维电脑租赁', keywords: ['台式机租赁','电脑租赁','笔记本租赁','显示器租赁','一体机租赁','电商电脑租赁','公司电脑租赁','游戏工作室电脑租赁','龙岩电脑租赁','速维租赁'] }
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
