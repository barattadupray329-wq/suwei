'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BriefcaseBusiness, LoaderCircle, MessageSquareText, Monitor, Phone, ShieldCheck } from 'lucide-react'

export function CustomerPhoneLogin({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [countdown, setCountdown] = useState(0)
  const [identities, setIdentities] = useState<{ workspace: boolean; customer: boolean } | null>(null)
  const [shopName, setShopName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const validPhone = /^1\d{10}$/.test(phone)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  async function requestCode() {
    if (!agreed) {
      setMessage('请先阅读并同意用户协议和隐私政策')
      setMessageType('error')
      return
    }
    if (!validPhone || pendingAction || countdown > 0) return
    setPendingAction('send')
    setMessage('')
    try {
      const response = await fetch('/api/customer-auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, consent: agreed }) })
      const result = await response.json().catch(() => ({ message: '短信服务暂时繁忙，请稍后重试' })) as { message: string; shopName?: string; retryAfter?: number }
      setShopName(result.shopName ?? '')
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

  async function enterWorkspace() {
    setPendingAction('verify')
    setMessage('')
    await fetch('/api/customer-auth/logout', { method: 'POST' })
    router.push('/dashboard')
    router.refresh()
  }

  async function verify() {
    if (!validPhone || code.length !== 6 || pendingAction) return
    setPendingAction('verify')
    setMessage('')
    try {
      const response = await fetch('/api/customer-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
      const result = await response.json().catch(() => ({ message: '验证服务暂时繁忙，请稍后重试' })) as { message: string; retryAfter?: number; identities?: { workspace: boolean; customer: boolean } }
      if (!response.ok || !result.identities) {
        setMessage(result.message)
        setMessageType('error')
        if (result.retryAfter) setCountdown(Number(result.retryAfter))
        return
      }
      if (result.identities.workspace && result.identities.customer) {
        setIdentities(result.identities)
      } else if (result.identities.workspace) {
        await enterWorkspace()
      } else {
        router.push('/customer')
        router.refresh()
      }
    } catch {
      setMessage('网络连接失败，请检查网络后重试')
      setMessageType('error')
    } finally {
      setPendingAction(null)
    }
  }

  if (identities) return <div className="mt-6 flex flex-col gap-3" role="group" aria-label="选择登录身份">
    <div className="rounded-xl bg-primary/10 p-4"><h2 className="font-semibold text-primary">请选择要进入的身份</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">该手机号同时绑定了团队账号和在租信息。</p></div>
    <button type="button" onClick={() => void enterWorkspace()} disabled={Boolean(pendingAction)} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted disabled:opacity-60"><BriefcaseBusiness className="size-5 text-primary" /><span><strong className="block">进入工作台</strong><span className="text-sm text-muted-foreground">管理合同、设备和业务数据</span></span></button>
    <button type="button" onClick={() => { router.push('/customer'); router.refresh() }} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted"><Monitor className="size-5 text-primary" /><span><strong className="block">查看我的租赁</strong><span className="text-sm text-muted-foreground">仅查看本人当前在租信息</span></span></button>
  </div>

  return (
    <main className={embedded ? 'mt-6' : 'flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-4'}>
      <div className={embedded ? 'hidden' : 'flex w-full max-w-md items-center justify-between'}>
        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回速维租赁官网</Link>
        <a href="tel:05972685521" className="flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="size-4" />0597-2685521</a>
      </div>
      <section className={embedded ? 'w-full' : 'w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-xl'}>
        <header className={embedded ? 'hidden' : 'bg-primary p-6 text-primary-foreground'}>
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15"><ShieldCheck className="size-6" /></span>
          <h1 className="mt-5 text-balance text-2xl font-bold">客户服务中心</h1>
          <p className="mt-2 text-sm leading-6 opacity-80">输入合同手机号和短信验证码，查看设备、合同、费用与服务进度。</p>
        </header>
        <form className={embedded ? 'flex flex-col gap-5' : 'flex flex-col gap-5 p-6'} onSubmit={(event) => { event.preventDefault(); void verify() }}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            {embedded ? '登录手机号' : '合同手机号'}
            <div className="flex gap-2">
              <input inputMode="tel" autoComplete="tel" required pattern="1[0-9]{10}" value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 11)); setShopName(''); setMessage('') }} className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring" placeholder="请输入 11 位手机号" />
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
          <div className="rounded-xl bg-muted p-4 text-sm">
            <strong className="text-foreground">三步查看租赁信息</strong>
            <ol className="mt-2 list-inside list-decimal leading-6 text-muted-foreground"><li>输入合同登记的手机号</li><li>获取并填写短信验证码</li><li>查看合同、设备、租期、账单和负责人</li></ol>
          </div>
          <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
            <input type="checkbox" checked={agreed} onChange={(event) => { setAgreed(event.target.checked); setMessage('') }} className="mt-1 size-4 shrink-0 accent-primary" />
            <span>我已阅读并同意 <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">《用户协议》</Link> 和 <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">《隐私政策》</Link>，同意使用手机号接收本次身份验证码。</span>
          </label>
          {shopName ? <p className="rounded-xl border bg-muted px-4 py-3 text-sm"><span className="text-muted-foreground">所属店铺</span><strong className="ml-2 text-foreground">{shopName}</strong></p> : null}
          {message && <p role={messageType === 'error' ? 'alert' : 'status'} aria-live="polite" className={`rounded-xl px-4 py-3 text-sm ${messageType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>{message}</p>}
          <button type="submit" disabled={!validPhone || code.length !== 6 || Boolean(pendingAction)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
            {pendingAction === 'verify' ? <LoaderCircle className="size-5 animate-spin" /> : <MessageSquareText className="size-5" />}{pendingAction === 'verify' ? '正在验证…' : embedded ? '验证并登录' : '验证并查看租赁'}
          </button>
          <p className="text-xs leading-5 text-muted-foreground">{embedded ? '验证码仅用于本次登录。租赁客户只能查看本人当前在租信息，请勿向他人提供验证码。' : '为保护客户隐私，无有效在租记录的手机号不会获得任何数据。请勿向他人提供验证码。'}</p>
        </form>
      </section>
    </main>
  )
}
