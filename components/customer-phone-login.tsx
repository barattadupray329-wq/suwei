'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LoaderCircle, MessageSquareText, Phone, ShieldCheck } from 'lucide-react'

export function CustomerPhoneLogin() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [countdown, setCountdown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)
  const validPhone = /^1\d{10}$/.test(phone)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  async function requestCode() {
    if (!validPhone || pendingAction || countdown > 0) return
    setPendingAction('send')
    setMessage('')
    try {
      const response = await fetch('/api/customer-auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const result = await response.json().catch(() => ({ message: '短信服务暂时繁忙，请稍后重试' })) as { message: string; retryAfter?: number }
      setMessage(result.message)
      setMessageType(response.ok ? 'success' : 'error')
      if (response.ok) {
        setCountdown(Number(result.retryAfter) || 60)
        window.setTimeout(() => codeRef.current?.focus(), 0)
      } else if (result.retryAfter) setCountdown(Number(result.retryAfter))
    } catch {
      setMessage('网络连接失败，请检查网络后重试')
      setMessageType('error')
    } finally {
      setPendingAction(null)
    }
  }

  async function verify() {
    if (!validPhone || code.length !== 6 || pendingAction) return
    setPendingAction('verify')
    setMessage('')
    try {
      const response = await fetch('/api/customer-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const result = await response.json().catch(() => ({ message: '验证服务暂时繁忙，请稍后重试' })) as { message: string; retryAfter?: number }
      if (!response.ok) {
        setMessage(result.message)
        setMessageType('error')
        if (result.retryAfter) setCountdown(Number(result.retryAfter))
        return
      }
      router.push('/customer')
      router.refresh()
    } catch {
      setMessage('网络连接失败，请检查网络后重试')
      setMessageType('error')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-4">
      <div className="flex w-full max-w-md items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回速维租赁官网</Link>
        <a href="tel:05972685521" className="flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="size-4" />0597-2685521</a>
      </div>
      <section className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl">
        <header className="bg-primary p-6 text-primary-foreground">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15"><ShieldCheck className="size-6" /></span>
          <h1 className="mt-5 text-balance text-2xl font-bold">客户服务中心</h1>
          <p className="mt-2 text-sm leading-6 opacity-80">输入合同手机号和短信验证码，查看设备、合同、费用与服务进度。</p>
        </header>
        <form className="flex flex-col gap-5 p-6" onSubmit={(event) => { event.preventDefault(); void verify() }}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            合同手机号
            <div className="flex gap-2">
              <input inputMode="tel" autoComplete="tel" required pattern="1[0-9]{10}" value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 11)); setMessage('') }} className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring" placeholder="请输入 11 位手机号" />
              <button type="button" onClick={() => void requestCode()} disabled={!validPhone || Boolean(pendingAction) || countdown > 0} className="flex h-12 min-w-28 items-center justify-center rounded-xl border border-primary px-3 text-sm font-semibold text-primary disabled:border-border disabled:text-muted-foreground disabled:opacity-70">
                {pendingAction === 'send' ? <LoaderCircle className="size-4 animate-spin" /> : countdown > 0 ? `${countdown} 秒` : '获取验证码'}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            短信验证码
            <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setMessage('') }} className="h-12 rounded-xl border bg-background px-4 text-center text-lg tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring" placeholder="请输入 6 位验证码" />
            <span className="text-xs font-normal text-muted-foreground">验证码 5 分钟内有效。未收到时请在倒计时结束后重新获取。</span>
          </label>
          {message && <p role={messageType === 'error' ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${messageType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{message}</p>}
          <button type="submit" disabled={!validPhone || code.length !== 6 || Boolean(pendingAction)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
            {pendingAction === 'verify' ? <LoaderCircle className="size-5 animate-spin" /> : <MessageSquareText className="size-5" />}{pendingAction === 'verify' ? '正在验证…' : '验证并查看租赁'}
          </button>
          <p className="text-xs leading-5 text-muted-foreground">为保护客户隐私，无有效在租记录的手机号不会获得任何数据。请勿向他人提供验证码。</p>
        </form>
      </section>
    </main>
  )
}
