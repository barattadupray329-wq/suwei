import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
export const metadata: Metadata = { title: '速维租赁管理', description: '电脑租赁业务管理平台' }
export const viewport: Viewport = { themeColor: '#f5f7f6', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN" className="bg-background"><body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>{children}<Toaster richColors position="top-center" /></body></html> }
