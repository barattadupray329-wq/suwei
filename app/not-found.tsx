import { ArrowLeft, FileQuestion } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[70svh] items-center justify-center bg-background p-4">
      <section aria-labelledby="not-found-title" className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><FileQuestion className="size-6" aria-hidden="true" /></span>
        <div className="flex flex-col gap-2"><p className="text-sm font-semibold text-primary">404</p><h1 id="not-found-title" className="text-balance text-2xl font-semibold">没有找到这个页面</h1><p className="text-pretty text-sm leading-6 text-muted-foreground">链接可能已经失效，或者页面地址输入有误。</p></div>
        <Link href="/" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><ArrowLeft className="size-4" aria-hidden="true" />返回首页</Link>
      </section>
    </main>
  )
}
