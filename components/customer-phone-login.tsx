'use client'

import { useState } from 'react'
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

  async function requestCode() {
    setPending(true); setMessage('')
    const response = await fetch('/api/customer-auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
    const result = await response.json()
    setPending(false); setMessage(result.message)
    if (response.ok) setSent(true)
  }
  async function verify() {
    setPending(true); setMessage('')
    const response = await fetch('/api/customer-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) })
    const result = await response.json()
    setPending(false)
    if (!response.ok) { setMessage(result.message); return }
    router.push('/customer'); router.refresh()
  }

  return <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-4"><div className="flex w-full max-w-md items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回速维租赁官网</Link><a href="tel:05972685521" className="flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="size-4" />0597-2685521</a></div><section className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-xl"><header className="bg-primary p-6 text-primary-foreground"><span className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15"><ShieldCheck className="size-6" /></span><h1 className="mt-5 text-balance text-2xl font-bold">客户在租信息查询</h1><p className="mt-2 text-sm leading-6 opacity-80">使用合同中登记的手机号接收验证码，只查看属于您的当前在租信息。</p></header><form className="flex flex-col gap-5 p-6" onSubmit={(event) => { event.preventDefault(); sent ? verify() : requestCode() }}><label className="flex flex-col gap-2 text-sm font-medium">合同手机号<input inputMode="tel" autoComplete="tel" required pattern="1[0-9]{10}" value={phone} disabled={sent} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} className="h-12 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring disabled:bg-muted" placeholder="请输入 11 位手机号" /></label>{sent ? <label className="flex flex-col gap-2 text-sm font-medium">短信验证码<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 rounded-xl border bg-background px-4 text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring" placeholder="6 位验证码" /></label> : null}{message ? <p role="status" className="rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground">{message}</p> : null}<button disabled={pending || phone.length !== 11 || (sent && code.length !== 6)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">{pending ? <LoaderCircle className="size-5 animate-spin" /> : sent ? <LockKeyhole className="size-5" /> : <MessageSquareText className="size-5" />}{pending ? '正在处理…' : sent ? '验证并查看' : '获取短信验证码'}</button>{sent ? <button type="button" onClick={() => { setSent(false); setCode(''); setMessage('') }} className="text-sm text-primary hover:underline">更换手机号</button> : null}<p className="text-pretty text-xs leading-5 text-muted-foreground">为保护客户隐私，无有效在租记录的手机号不会获得任何数据。验证码 5 分钟有效，请勿转发给他人。</p></form></section></main>
}
