'use client'

import { useEffect, useState } from 'react'
import { KeyRound, LoaderCircle, MessageSquareText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function PasswordChangeForm({ compact = false, loginPath = '/login' }: { compact?: boolean; loginPath?: string }) {
  const router = useRouter()
  const [maskedPhone, setMaskedPhone] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [pending, setPending] = useState(false)

  useEffect(() => { fetch('/api/password-change').then(async (response) => response.ok ? await response.json() as { maskedPhone: string } : null).then((data) => setMaskedPhone(data?.maskedPhone ?? '')).catch(() => undefined) }, [])
  useEffect(() => { if (countdown <= 0) return; const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer) }, [countdown])

  async function sendCode() {
    if (pending || countdown > 0) return
    setPending(true)
    try {
      const response = await fetch('/api/password-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request' }) })
      const result = await response.json() as { message: string; retryAfter?: number }
      if (!response.ok) throw Object.assign(new Error(result.message), { retryAfter: result.retryAfter })
      setCountdown(result.retryAfter ?? 60); toast.success(`验证码已发送至 ${maskedPhone}`)
    } catch (error) {
      const retryAfter = typeof error === 'object' && error && 'retryAfter' in error ? Number(error.retryAfter) : 0
      if (retryAfter) setCountdown(retryAfter)
      toast.error(error instanceof Error ? error.message : '验证码发送失败')
    } finally { setPending(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (newPassword !== confirmPassword) return toast.error('两次输入的新密码不一致')
    setPending(true)
    try {
      const response = await fetch('/api/password-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', code, newPassword, confirmPassword }) })
      const result = await response.json() as { message: string }
      if (!response.ok) throw new Error(result.message)
      toast.success(result.message)
      router.push(loginPath); router.refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : '密码修改失败') }
    finally { setPending(false) }
  }

  return <form onSubmit={submit} className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm'} aria-busy={pending}><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="size-5" /></span><div><h2 className="font-semibold">手机验证修改密码</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">验证码将发送至绑定手机 {maskedPhone || '读取中…'}，无需输入当前密码。</p></div></div><label className="flex flex-col gap-2 text-sm font-medium">短信验证码<div className="flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" placeholder="6 位验证码" className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /><button type="button" disabled={pending || countdown > 0 || !maskedPhone} onClick={sendCode} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50"><MessageSquareText className="size-4" />{countdown > 0 ? `${countdown} 秒` : '获取验证码'}</button></div></label><label className="flex flex-col gap-2 text-sm font-medium">新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="至少 8 位" /></label><label className="flex flex-col gap-2 text-sm font-medium">确认新密码<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required className="h-11 rounded-lg border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="再次输入新密码" /></label><button disabled={pending || code.length !== 6 || newPassword.length < 8 || !confirmPassword} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending && <LoaderCircle className="size-4 animate-spin" />}{pending ? '正在验证…' : '验证并修改密码'}</button></form>
}
