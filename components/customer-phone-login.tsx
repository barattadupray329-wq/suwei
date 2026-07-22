'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LoaderCircle, LockKeyhole, MessageSquareText, Phone, ShieldCheck } from 'lucide-react'

export function CustomerPhoneLogin() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [countdown, setCountdown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  async function requestCode() {
    if (pending || countdown > 0) return
    setPending(true); setMessage('')
    try {
      const response = await fetch('/api/customer-auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const result = await response.json().catch(() => ({ message: '短信服务暂时繁忙，请稍后重试' })) as { message: string; retryAfter?: number }
      setMessage(result.message); setMessageType(response.ok ? 'success' : 'error')
      if (response.ok) {
        setSent(true); setCountdown(Number(result.retryAfter) || 60)
        window.setTimeout(() => codeRef.current?.focus(), 0)
      } else if (result.retryAfter) setCountdown(Number(result.retryAfter))
    } catch {
      setMessage('网络连接失败，请检查网络后重试'); setMessageType('error')
    } finally { setPending(false) }
  }
  async function verify() {
    if (pending || code.length !== 6) return
    setPending(true); setMessage('')
    try {
      const response = await fetch('/api/customer-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const result = await response.json().catch(() => ({ message: '验证服务暂时繁忙，请稍后重试' })) as { message: string; retryAfter?: number }
      if (!response.ok) { setMessage(result.message); setMessageType('error'); if (result.retryAfter) setCountdown(Number(result.retryAfter)); return }
      router.push('/customer'); router.refresh()
    } catch {
      setMessage('网络连接失败，请检查网络后重试'); setMessageType('error')
    } finally { setPending(false) }
  }

  function changePhone() {
    setSent(false); setCode(''); setMessage(''); setCountdown(0)
  }

  return <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-4"><div className="flex w-full max-w-md items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回速维租赁官网</Link><a href="tel:05972685521" className="flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="size-4" />0597-2685521</a></div><section className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl"><header className="bg-primary p-6 text-primary-foreground"><span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15"><ShieldCheck className="size-6" /></span><h1 className="mt-5 text-balance text-2xl font-bold">客户服务中心</h1><p className="mt-2 text-sm leading-6 opacity-80">使用合同登记手机号验证身份，查看您的设备、合同、费用与服务进度。</p></header><form className="flex flex-col gap-5 p-6" onSubmit={(event) => { event.preventDefault(); if (sent) void verify(); else void requestCode() }}><label className="flex flex-col gap-2 text-sm font-medium">合同手机号<input inputMode="tel" autoComplete="tel" required pattern="1[0-9]{10}" value={phone} disabled={sent} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} className="h-12 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring disabled:bg-muted" placeholder="请输入 11 位手机号" /></label>{sent ? <label className="flex flex-col gap-2 text-sm font-medium">短信验证码<input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 rounded-xl border bg-background px-4 text-center text-lg tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring" placeholder="请输入 6 位验证码" /><span className="text-xs font-normal text-muted-foreground">验证码 5 分钟内有效，请勿转发给他人。</span></label> : null}{message ? <p role={messageType === 'error' ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl border p-3 text-sm leading-6 ${messageType === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-primary/20 bg-primary/5 text-foreground'}`}>{message}</p> : null}<button disabled={pending || phone.length !== 11 || (sent && code.length !== 6)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">{pending ? <LoaderCircle className="size-5 animate-spin" /> : sent ? <LockKeyhole className="size-5" /> : <MessageSquareText className="size-5" />}{pending ? '正在处理…' : sent ? '验证并查看' : '获取短信验证码'}</button>{sent ? <div className="flex items-center justify-between gap-4 text-sm"><button type="button" onClick={changePhone} className="font-semibold text-primary hover:underline">更换手机号</button><button type="button" disabled={pending || countdown > 0} onClick={requestCode} className="font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">{countdown > 0 ? `${countdown} 秒后重新发送` : '重新发送验证码'}</button></div> : null}<p className="text-pretty text-xs leading-5 text-muted-foreground">为保护客户隐私，无有效在租记录的手机号不会获得任何数据。验证码 5 分钟有效，请勿转发给他人。</p></form></section></main>
}
