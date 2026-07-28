import Link from 'next/link'
import { ArrowLeft, LayoutDashboard } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-primary">页面未找到</p>
        <h1 className="mt-2 text-balance text-2xl font-bold text-foreground">这个地址可能已失效或输入有误</h1>
        <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">您可以返回经营总览继续工作，或回到网站首页重新进入。</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <LayoutDashboard aria-hidden="true" />
            返回经营总览
          </Link>
          <Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted">
            <ArrowLeft aria-hidden="true" />
            返回网站首页
          </Link>
        </div>
      </section>
    </main>
  )
}
