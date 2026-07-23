'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70svh] items-center justify-center bg-background p-4">
      <section aria-labelledby="error-title" className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="size-6" aria-hidden="true" /></span>
        <div className="flex flex-col gap-2"><h1 id="error-title" className="text-balance text-2xl font-semibold">页面暂时无法加载</h1><p className="text-pretty text-sm leading-6 text-muted-foreground">请稍后重试。若问题持续出现，请联系管理员并说明当前操作。</p></div>
        <button type="button" onClick={reset} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><RotateCcw className="size-4" aria-hidden="true" />重新加载</button>
      </section>
    </main>
  )
}
