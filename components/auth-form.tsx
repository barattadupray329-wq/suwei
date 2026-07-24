'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, MessageSquareText, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { CustomerPhoneLogin } from '@/components/customer-phone-login'
import { submitAdminApplication } from '@/app/actions/business'

type Method = 'phone' | 'account'

export function AuthForm({ mode, accessError = '' }: { mode: 'sign-in' | 'sign-up'; accessError?: string }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('phone')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [reset, setReset] = useState({ account: '', phone: '', code: '', newPassword: '', confirmPassword: '' })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(accessError)
  const [loading, setLoading] = useState(false)
  const [showApplication, setShowApplication] = useState(false)
  const [application, setApplication] = useState({ shopName: '', name: '', account: '', phone: '', password: '', confirmPassword: '' })
  const [applicationMessage, setApplicationMessage] = useState('')

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await authClient.signIn.username({ username: account.trim(), password })
      if (result.error) {
        setError(result.error.status === 429 ? '登录尝试过于频繁，请稍后再试' : '账号或密码不正确')
        return
      }
      // 交由服务端根据账号角色跳转，避免超级管理员误入店铺业务页。
      router.push('/sign-in')
      router.refresh()
    } catch {
      setError('登录服务暂时不可用，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }

  async function requestResetCode() {
    if (!reset.account.trim() || !/^1\d{10}$/.test(reset.phone) || countdown > 0) return
    setError(''); setMessage(''); setLoading(true)
    try {
      const response = await fetch('/api/account-password/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: reset.account, phone: reset.phone }) })
      const payload = await response.json() as { message?: string; retryAfter?: number }
      if (!response.ok) throw new Error(payload.message || '验证码发送失败')
      setMessage(payload.message || '验证码已发送'); setCountdown(60)
      const timer = window.setInterval(() => setCountdown((value) => { if (value <= 1) { window.clearInterval(timer); return 0 } return value - 1 }), 1000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '验证码发送失败') } finally { setLoading(false) }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true)
    try {
      const response = await fetch('/api/account-password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reset) })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message || '密码修改失败')
      setResetMode(false); setAccount(reset.account); setPassword(''); setReset({ account: '', phone: '', code: '', newPassword: '', confirmPassword: '' }); setMessage(payload.message || '密码已修改，请重新登录')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '密码修改失败') } finally { setLoading(false) }
  }

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await submitAdminApplication(application)
      setApplicationMessage('申请已提交。审核通过后可使用账号密码或绑定手机号登录。')
      setApplication({ shopName: '', name: '', account: '', phone: '', password: '', confirmPassword: '' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '申请提交失败')
    } finally { setLoading(false) }
  }

  return <main className="flex min-h-svh items-center justify-center bg-background p-4 sm:p-6 lg:p-10">
    <section className="flex w-full max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-xl lg:min-h-[640px]">
      <aside className="hidden w-3/5 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
        <div className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/15"><ShieldCheck /></span>速维租赁统一服务</div>
        <div className="flex max-w-xl flex-col gap-5"><p className="text-balance text-3xl font-semibold lg:text-4xl">一个入口，安全连接工作与租赁服务</p><p className="max-w-lg leading-relaxed opacity-80">团队成员进入业务工作台，租赁客户查看本人当前在租信息。</p></div>
        <p className="text-sm opacity-70">短信验证码 5 分钟有效 · 全程加密传输</p>
      </aside>
      <div className="flex w-full flex-col justify-center p-6 sm:p-8 md:w-2/5 md:p-10 lg:p-12">
        <div className="flex flex-col gap-2"><p className="text-sm font-semibold text-primary">SUWEI WEB</p><h1 className="text-balance text-3xl font-semibold">{mode === 'sign-up' ? '申请或登录速维租赁' : '登录速维租赁'}</h1><p className="text-sm text-muted-foreground">请选择适合您的登录方式</p></div>
        {!showApplication ? <>
          <div className="mt-6 flex rounded-xl bg-muted p-1" role="tablist" aria-label="登录方式">
            <button type="button" role="tab" aria-selected={method === 'phone'} onClick={() => { setMethod('phone'); setError('') }} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${method === 'phone' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><MessageSquareText className="size-4" />手机验证码</button>
            <button type="button" role="tab" aria-selected={method === 'account'} onClick={() => { setMethod('account'); setError('') }} className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium ${method === 'account' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><KeyRound className="size-4" />账号密码</button>
          </div>
          {method === 'phone' ? <CustomerPhoneLogin embedded /> : resetMode ? <form onSubmit={submitPasswordReset} className="mt-6 flex flex-col gap-4"><div><h2 className="font-semibold">短信验证修改密码</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">验证码将发送至账号绑定手机号，修改后所有设备需重新登录。</p></div><label className="flex flex-col gap-2 text-sm font-medium">登录账号<input className="h-11 rounded-lg border bg-background px-3" value={reset.account} onChange={(event) => setReset((value) => ({ ...value, account: event.target.value }))} required autoComplete="username" /></label><label className="flex flex-col gap-2 text-sm font-medium">绑定手机号<input inputMode="numeric" pattern="1[0-9]{10}" autoComplete="tel" className="h-11 rounded-lg border bg-background px-3" value={reset.phone} onChange={(event) => setReset((value) => ({ ...value, phone: event.target.value.replace(/\D/g, '').slice(0, 11) }))} required placeholder="请输入账号绑定的手机号" /></label><label className="flex flex-col gap-2 text-sm font-medium">短信验证码<span className="flex gap-2"><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3" value={reset.code} onChange={(event) => setReset((value) => ({ ...value, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} required placeholder="6 位验证码" /><button type="button" disabled={loading || countdown > 0 || !reset.account.trim() || !/^1\d{10}$/.test(reset.phone)} onClick={requestResetCode} className="h-11 shrink-0 rounded-lg border px-4 text-sm font-medium disabled:opacity-50">{countdown > 0 ? `${countdown} 秒` : '获取验证码'}</button></span></label><label className="flex flex-col gap-2 text-sm font-medium">新密码<span className="relative"><input type={showNewPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" className="h-11 w-full rounded-lg border bg-background px-3 pr-11" value={reset.newPassword} onChange={(event) => setReset((value) => ({ ...value, newPassword: event.target.value }))} required /><button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? '隐藏新密码' : '显示新密码'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground">{showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label><label className="flex flex-col gap-2 text-sm font-medium">确认新密码<input type={showNewPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" className="h-11 rounded-lg border bg-background px-3" value={reset.confirmPassword} onChange={(event) => setReset((value) => ({ ...value, confirmPassword: event.target.value }))} required /></label>{error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p> : null}<button disabled={loading || reset.code.length !== 6} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}{loading ? '正在修改…' : '确认修改密码'}</button><button type="button" onClick={() => { setResetMode(false); setError(''); setMessage('') }} className="h-10 text-sm font-medium text-muted-foreground hover:text-foreground">返回账号登录</button></form> : <form onSubmit={submitPassword} className="mt-6 flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium">账号<input className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" value={account} onChange={(event) => setAccount(event.target.value)} required autoComplete="username" placeholder="用户名或邮箱格式账号" /></label>
            <label className="flex flex-col gap-2 text-sm font-medium">密码<span className="relative"><input type={showPassword ? 'text' : 'password'} className="h-11 w-full rounded-lg border bg-background px-3 pr-11 outline-none focus:ring-2 focus:ring-ring" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
            <div className="flex justify-end"><button type="button" onClick={() => { setResetMode(true); setReset((value) => ({ ...value, account: account.trim() })); setError(''); setMessage('') }} className="text-sm font-medium text-primary hover:underline">修改或忘记密码</button></div>
            {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}{message ? <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p> : null}
            <button disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{loading ? '正在登录…' : '登录工作台'}</button>
            <p className="text-xs leading-5 text-muted-foreground">租赁客户没有账号密码，请使用手机号验证码登录。</p>
          </form>}
        </> : <form onSubmit={submitApplication} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">店铺名称<input className="h-10 rounded-lg border bg-background px-3" value={application.shopName} onChange={(event) => setApplication((value) => ({ ...value, shopName: event.target.value }))} required placeholder="例如：速维电脑租赁" /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">管理员姓名<input className="h-10 rounded-lg border bg-background px-3" value={application.name} onChange={(event) => setApplication((value) => ({ ...value, name: event.target.value }))} required /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">登录账号<input className="h-10 rounded-lg border bg-background px-3" value={application.account} onChange={(event) => setApplication((value) => ({ ...value, account: event.target.value }))} required placeholder="用户名或邮箱格式账号" /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">手机号<input inputMode="numeric" pattern="1[0-9]{10}" className="h-10 rounded-lg border bg-background px-3" value={application.phone} onChange={(event) => setApplication((value) => ({ ...value, phone: event.target.value.replace(/\D/g, '').slice(0, 11) }))} required /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">登录密码<input type="password" minLength={8} className="h-10 rounded-lg border bg-background px-3" value={application.password} onChange={(event) => setApplication((value) => ({ ...value, password: event.target.value }))} required /></label>
          <label className="flex flex-col gap-2 text-sm font-medium">确认密码<input type="password" minLength={8} className="h-10 rounded-lg border bg-background px-3" value={application.confirmPassword} onChange={(event) => setApplication((value) => ({ ...value, confirmPassword: event.target.value }))} required /></label>
          {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}{applicationMessage ? <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{applicationMessage}</p> : null}
          <button disabled={loading} className="h-11 rounded-lg bg-primary font-medium text-primary-foreground disabled:opacity-60">{loading ? '正在提交…' : '提交管理员申请'}</button>
        </form>}
        <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="leading-6">员工账号由管理员创建；邮箱只可作为账号文本，不用于邮箱验证。</p><button type="button" onClick={() => { setShowApplication((value) => !value); setError(''); setApplicationMessage('') }} className="mt-2 font-medium text-primary hover:underline">{showApplication ? '返回登录' : '申请管理员账号'}</button></div></div>
      </div>
    </section>
  </main>
}
