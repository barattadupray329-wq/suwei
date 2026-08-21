'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bot, Clock3, Database, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { askXiaowei, confirmXiaoweiDueSms, type XiaoweiAnswer, type XiaoweiMessage } from '@/app/actions/xiaowei'
import { XiaoweiSmsConfirmation } from '@/components/xiaowei-sms-confirmation'

type ChatItem = XiaoweiMessage & { answer?: XiaoweiAnswer }
const starters = ['分析一下当前经营情况', '当前逾期待收情况怎么样？', '本月实际收款多少？', '给我一份今日经营建议']

export function XiaoweiAssistant() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [pending, setPending] = useState(false)
  const [quotaEnded, setQuotaEnded] = useState(false)
  const [sendingToken, setSendingToken] = useState<string | null>(null)
  const [cancelledTokens, setCancelledTokens] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const ask = async (value: string) => {
    const text = value.trim()
    if (!text || pending || quotaEnded) return
    const history = messages.map(({ role, content }) => ({ role, content })).slice(-6)
    setMessages((current) => [...current, { role: 'user', content: text }])
    setQuestion('')
    setPending(true)
    try {
      const answer = await askXiaowei(text, history)
      setMessages((current) => [...current, { role: 'assistant', content: answer.summary, answer }])
    } catch (error) {
      const message = error instanceof Error ? error.message : '小维暂时无法回答，请稍后重试'
      if (message.includes('免费额度已用完')) setQuotaEnded(true)
      toast.error(message)
    } finally { setPending(false) }
  }
  const confirmSms = async (token: string) => {
    if (sendingToken) return
    setSendingToken(token)
    try {
      const result = await confirmXiaoweiDueSms(token)
      setCancelledTokens((current) => [...current, token])
      setMessages((current) => [...current, { role: 'assistant', content: `${result.summary}\n${result.details.join('\n')}` }])
      result.ok ? toast.success(result.summary) : toast.error(result.summary)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '短信发送失败，请稍后重试')
    } finally { setSendingToken(null) }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(question) }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-sm font-bold text-primary hover:bg-primary/15" aria-label="打开小维助手">
      <span className="relative flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4"/><span className="absolute -right-1 -top-1 size-2 rounded-full border border-card bg-primary"/></span><span className="hidden sm:inline">小维</span>
    </button>
    {open && <div className="fixed inset-0 z-[70] flex h-dvh justify-end overflow-hidden"><button type="button" aria-label="关闭小维" className="absolute inset-0 bg-foreground/25" onClick={() => setOpen(false)}/><aside role="dialog" aria-modal="true" aria-label="小维 AI 业务助手" className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden border-l bg-card shadow-2xl sm:max-w-xl">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b bg-card px-4 py-2 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Bot className="size-5"/></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold">小维</p><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Cloudflare AI</span></div><p className="truncate text-xs text-muted-foreground">只读业务分析 · 实时店铺数据</p></div></div><button type="button" aria-label="关闭" onClick={() => setOpen(false)} className="icon-button"><X/></button></header>
      <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background p-4 sm:p-6">
        {!messages.length ? <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6"><div><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6"/></span><h2 className="mt-4 text-xl font-bold text-balance">今天想让小维分析什么？</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">小维会先读取当前店铺的合同、账单、收款和业务记录，再给出有依据的回答。</p></div><div className="grid gap-2 sm:grid-cols-2">{starters.map((item) => <button key={item} type="button" onClick={() => void ask(item)} className="flex items-center justify-between rounded-xl border bg-card p-4 text-left text-sm font-semibold hover:border-primary/40 hover:bg-primary/5"><span>{item}</span><ArrowRight className="size-4 text-primary"/></button>)}</div><div className="flex gap-3 rounded-xl border bg-muted/40 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">严格只读</p><p className="mt-1 text-xs leading-5 text-muted-foreground">小维不会收款、退租、修改合同或删除数据。免费额度用完后立即停止，不会自动产生 AI 费用。</p></div></div></div> : <div className="mx-auto flex max-w-xl flex-col gap-5">{messages.map((item, index) => item.role === 'user' ? <div key={index} className="ml-10 self-end rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">{item.content}</div> : <article key={index} className="rounded-2xl border bg-card p-5"><div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="size-4"/></span><p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p></div>{item.answer && <>{item.answer.smsPreview && <XiaoweiSmsConfirmation preview={item.answer.smsPreview} sending={sendingToken === item.answer.smsPreview.token} cancelled={cancelledTokens.includes(item.answer.smsPreview.token)} onConfirm={() => void confirmSms(item.answer!.smsPreview!.token)} onCancel={() => setCancelledTokens((current) => [...current, item.answer!.smsPreview!.token])}/>}<div className="mt-4 grid gap-2">{item.answer.facts.slice(0, 4).map((fact) => <div key={fact} className="rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{fact}</div>)}</div><div className="mt-4 flex flex-wrap gap-2">{item.answer.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:bg-primary/5">{suggestion}</button>)}</div><div className="mt-4 border-t pt-4"><div className="flex flex-col gap-1 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Database className="size-3.5 text-primary"/>{item.answer.scope}</span><span className="flex items-center gap-2"><Clock3 className="size-3.5 text-primary"/>更新于 {item.answer.updatedAt} · 今日约可再问 {item.answer.remainingRequests} 次</span></div><Link href={item.answer.href} onClick={() => setOpen(false)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">{item.answer.hrefLabel}<ArrowRight className="size-4"/></Link></div></>}</article>)}{pending && <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary"/>小维正在核对实时数据并分析…</div>}</div>}
      </div>
      <form onSubmit={submit} className="shrink-0 border-t bg-card p-4"><div className="mx-auto max-w-xl"><div className="flex items-center gap-2 rounded-xl border bg-background p-1.5 focus-within:border-primary"><input id="xiaowei-question" ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }} disabled={quotaEnded} maxLength={300} placeholder={quotaEnded ? '今日 AI 免费额度已用完，请明日再试' : '继续问小维…'} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed"/><button type="submit" disabled={pending || quotaEnded || !question.trim()} className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="发送问题"><Send className="size-4"/></button></div><p className="mt-2 text-center text-[11px] text-muted-foreground">AI 仅提供只读分析，重要数据请以业务页面为准</p></div></form>
    </aside></div>}
  </>
}
