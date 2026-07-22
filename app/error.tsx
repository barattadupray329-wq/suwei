'use client'

import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <section className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border bg-card p-8 text-center shadow-xl">
        <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></span>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-semibold">页面暂时无法加载</h1>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">系统遇到临时问题，请刷新重试。如果仍无法打开，请重新登录。</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground"><RefreshCw className="size-4" />重新加载</button>
          <Link href="/sign-in" className="flex h-11 flex-1 items-center justify-center rounded-lg border font-medium">返回登录</Link>
        </div>
        {error.digest ? <p className="text-xs text-muted-foreground">错误编号：{error.digest}</p> : null}
      </section>
    </main>
  )
}
