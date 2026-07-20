'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode: _mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const result = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? '邮箱或密码不正确')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <section className="flex w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
          <div className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/15"><ShieldCheck /></span>速维租赁管理</div>
          <div className="flex flex-col gap-4"><p className="text-balance text-3xl font-semibold">让每一台设备、每一笔租金都有迹可循</p><p className="leading-relaxed opacity-80">面向电脑租赁门店的安全、高效业务工作台。</p></div>
          <p className="text-sm opacity-70">数据加密传输 · 多设备随时访问</p>
        </div>
        <div className="w-full p-8 md:w-1/2 md:p-10">
          <div className="mb-8 flex flex-col gap-2"><p className="text-sm font-semibold text-primary">SUWEI WEB</p><h1 className="text-balance text-3xl font-semibold">欢迎回来</h1><p className="text-muted-foreground">登录后进入业务工作台</p></div>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium">邮箱<input type="email" className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
            <label className="flex flex-col gap-2 text-sm font-medium">密码<input type="password" className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="current-password" /></label>
            {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            <button disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? <><LoaderCircle className="size-4 animate-spin" />正在登录…</> : '登录工作台'}</button>
          </form>
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /><p className="leading-6">系统不开放自行注册。员工账号仅由超级管理员创建，如需账号请联系管理员。</p></div>
        </div>
      </section>
    </main>
  )
}
