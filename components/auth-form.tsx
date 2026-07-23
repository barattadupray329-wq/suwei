'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LoaderCircle, LockKeyhole, MessageSquareText } from 'lucide-react'
import { submitAdminApplication } from '@/app/actions/business'

export function AuthForm({ mode: _mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const codeRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'phone' | 'password'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apply, setApply] = useState(false)
  const [application, setApplication] = useState({ name: '', username: '', phone: '', password: '', confirmPassword: '' })
  useEffect(() => { if (!countdown) return; const timer = window.setInterval(() => setCountdown(v => Math.max(0, v - 1)), 1000); return () => window.clearInterval(timer) }, [countdown])

  async function requestCode() {
    setLoading(true); setError('')
    const response = await fetch('/api/account-auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
    const result = await response.json() as { message?: string; retryAfter?: number }
    setLoading(false)
    if (!response.ok) return setError(result.message ?? '验证码发送失败')
    setCountdown(result.retryAfter ?? 60); codeRef.current?.focus()
  }
  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    const response = tab === 'phone'
      ? await fetch('/api/account-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      : await fetch('/api/account-auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity, password }) })
    const result = await response.json().catch(() => ({})) as { message?: string; destination?: string }
    setLoading(false)
    if (!response.ok) return setError(result.message ?? '登录失败，请检查后重试')
    router.push(result.destination === 'customer' ? '/customer' : '/dashboard'); router.refresh()
  }
  async function submitApplication(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try { await submitAdminApplication(application); setApply(false); setError('申请已提交，请等待超级管理员审核') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '申请失败') }
    finally { setLoading(false) }
  }
  const field = 'h-12 rounded-xl border border-border bg-muted/45 px-4 text-base outline-none focus:ring-2 focus:ring-ring'
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 p-3 sm:p-6"><section className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
    <header className="flex flex-col gap-1"><p className="text-sm font-bold text-primary">SUWEI WEB</p><h1 className="text-balance text-3xl font-bold tracking-tight">登录速维租赁</h1><p className="text-muted-foreground">请选择适合您的登录方式</p></header>
    {!apply ? <><div className="mt-6 flex rounded-xl bg-muted p-1"><button onClick={() => setTab('phone')} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm ${tab === 'phone' ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}><MessageSquareText className="size-4" />手机验证码</button><button onClick={() => setTab('password')} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm ${tab === 'password' ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}><KeyRound className="size-4" />账号密码</button></div>
    <form onSubmit={login} className="mt-6 flex flex-col gap-5">{tab === 'phone' ? <><label className="flex flex-col gap-2 text-sm font-medium">登录手机号<span className="flex gap-2"><input className={`${field} min-w-0 flex-1`} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="tel" placeholder="请输入 11 位手机号" required /><button type="button" disabled={loading || countdown > 0 || phone.length !== 11} onClick={requestCode} className="rounded-xl border px-4 text-sm disabled:opacity-50">{countdown ? `${countdown} 秒` : '获取验证码'}</button></span></label><label className="flex flex-col gap-2 text-sm font-medium">短信验证码<input ref={codeRef} className={`${field} text-center tracking-[.35em]`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="请输入 6 位验证码" required /><span className="text-xs font-normal text-muted-foreground">验证码 5 分钟内有效。未收到请在倒计时结束后重新获取。</span></label></> : <><label className="flex flex-col gap-2 text-sm font-medium">用户名或手机号<input className={field} value={identity} onChange={e => setIdentity(e.target.value)} autoComplete="username" required /></label><label className="flex flex-col gap-2 text-sm font-medium">密码<input className={field} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" minLength={8} required /></label></>}{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<button disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground disabled:opacity-50">{loading && <LoaderCircle className="size-4 animate-spin" />}{tab === 'phone' ? '验证并登录' : '登录工作台'}</button></form>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">验证码仅用于本次登录。租赁客户只能查看本人当前在租信息，请勿向他人提供验证码。</p><div className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground"><p className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" />员工账号由管理员创建；管理员申请审核通过后方可登录。</p><button onClick={() => setApply(true)} className="mt-3 font-medium text-primary">申请管理员账号</button></div></> : <form onSubmit={submitApplication} className="mt-6 flex flex-col gap-4">{(['name','username','phone'] as const).map(key => <label key={key} className="flex flex-col gap-2 text-sm font-medium">{{name:'姓名',username:'用户名',phone:'手机号'}[key]}<input className={field} type={key === 'phone' ? 'tel' : 'text'} value={application[key]} onChange={e => setApplication(v => ({...v,[key]:key === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value}))} required /></label>)}<label className="flex flex-col gap-2 text-sm font-medium">密码<input className={field} type="password" minLength={8} value={application.password} onChange={e => setApplication(v => ({...v,password:e.target.value}))} required /></label><label className="flex flex-col gap-2 text-sm font-medium">确认密码<input className={field} type="password" minLength={8} value={application.confirmPassword} onChange={e => setApplication(v => ({...v,confirmPassword:e.target.value}))} required /></label>{error && <p className="text-sm text-destructive">{error}</p>}<button disabled={loading} className="h-12 rounded-xl bg-primary font-medium text-primary-foreground">提交管理员申请</button><button type="button" onClick={() => setApply(false)} className="text-sm text-primary">返回登录</button></form>}
  </section></main>
}
