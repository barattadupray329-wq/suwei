'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { submitAdminApplication } from '@/app/actions/business'

export function AuthForm({ mode: _mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showApplication, setShowApplication] = useState(false)
  const [application, setApplication] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [applicationMessage, setApplicationMessage] = useState('')

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await submitAdminApplication(application)
      setApplicationMessage('申请已提交。超级管理员审核通过后，才能使用该邮箱和密码登录。')
      setApplication({ name: '', email: '', phone: '', password: '', confirmPassword: '' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '申请提交失败')
    } finally {
      setLoading(false)
    }
  }

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
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6 lg:p-10">
      <section className="flex w-full max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-xl lg:min-h-[640px]">
        <div className="hidden w-3/5 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
          <div className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/15"><ShieldCheck /></span>速维租赁管理</div>
          <div className="flex max-w-xl flex-col gap-5"><p className="text-balance text-3xl font-semibold lg:text-4xl">统一管理合同、设备、收款与客户服务</p><p className="max-w-lg leading-relaxed opacity-80">面向租赁团队的日常业务管理中心。</p></div>
          <p className="text-sm opacity-70">数据加密传输 · 多设备随时访问</p>
        </div>
        <div className="flex w-full flex-col justify-center p-8 md:w-2/5 md:p-10 lg:p-12">
          <div className="mb-8 flex flex-col gap-2"><p className="text-sm font-semibold text-primary">SUWEI WEB</p><h1 className="text-balance text-3xl font-semibold">欢迎回来</h1><p className="text-muted-foreground">登录后进入业务工作台</p></div>
          {showApplication ? (
            <form onSubmit={submitApplication} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">姓名<input className="h-10 rounded-lg border bg-background px-3" value={application.name} onChange={(event) => setApplication((value) => ({ ...value, name: event.target.value }))} required /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">邮箱<input type="email" className="h-10 rounded-lg border bg-background px-3" value={application.email} onChange={(event) => setApplication((value) => ({ ...value, email: event.target.value }))} required /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">手机号<input inputMode="numeric" pattern="1[0-9]{10}" className="h-10 rounded-lg border bg-background px-3" value={application.phone} onChange={(event) => setApplication((value) => ({ ...value, phone: event.target.value.replace(/\D/g, '').slice(0, 11) }))} required /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium">登录密码<input type="password" minLength={8} className="h-10 rounded-lg border bg-background px-3" value={application.password} onChange={(event) => setApplication((value) => ({ ...value, password: event.target.value }))} required /></label><label className="flex flex-col gap-2 text-sm font-medium">确认密码<input type="password" minLength={8} className="h-10 rounded-lg border bg-background px-3" value={application.confirmPassword} onChange={(event) => setApplication((value) => ({ ...value, confirmPassword: event.target.value }))} required /></label></div>
              {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              {applicationMessage ? <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{applicationMessage}</p> : null}
              <button disabled={loading} className="h-11 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? '正在提交…' : '提交管理员申请'}</button>
            </form>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium">邮箱<input type="email" className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">密码<input type="password" className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-primary" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="current-password" /></label>
              {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              <button disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? <><LoaderCircle className="size-4 animate-spin" />正在登录…</> : '登录工作台'}</button>
            </form>
          )}
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="leading-6">员工账号只能由管理员创建。管理员申请审核通过前不能登录。</p><button type="button" onClick={() => { setShowApplication((value) => !value); setError(''); setApplicationMessage('') }} className="mt-2 font-medium text-primary hover:underline">{showApplication ? '返回登录' : '申请管理员账号'}</button></div></div>
        </div>
      </section>
    </main>
  )
}
