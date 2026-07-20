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
export const metadata: Metadata = { metadataBase: new URL('https://www.tuzhuzu.cn'), title: { default: '速维电脑租赁｜电脑按月租', template: '%s' }, description: '龙岩电脑租赁服务，办公、设计、电竞电脑按月灵活租用。', applicationName: '速维电脑租赁', keywords: ['龙岩电脑租赁','电脑月租','办公电脑租赁','电竞电脑租赁','速维租赁'] }
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
