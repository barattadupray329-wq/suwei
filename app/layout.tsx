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
export const metadata: Metadata = { title: '速维租赁管理', description: '电脑租赁业务管理平台' }
export const viewport: Viewport = { themeColor: '#f5f7f6', width: 'device-width', initialScale: 1 }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  let content = children
  if (session?.user) {
    const [access, storeName] = await Promise.all([getAccessContext(), getStoreName()])
    content = <AppShell storeName={storeName} userName={session.user.name} role={access.role} permissions={access.permissions}>{children}</AppShell>
  }
  return <html lang="zh-CN" className="bg-background"><body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>{content}<Toaster richColors position="top-center" /></body></html>
}
