'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Bot, Database, Search, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { askXiaowei, type XiaoweiAnswer } from '@/app/actions/xiaowei'
import { sendRentalReminders } from '@/app/actions/sms-reminders'
import { commonXiaoweiQuestions, xiaoweiQuestionCatalog } from '@/lib/xiaowei-question-catalog'

type XiaoweiMessage = { question: string; answer: XiaoweiAnswer }

export function XiaoweiAssistant() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [question, setQuestion] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [messages, setMessages] = useState<XiaoweiMessage[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [correcting, setCorrecting] = useState(false)
  const [answer, setAnswer] = useState<XiaoweiAnswer | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const submit = (value = question, clarification?: string) => {
    const clean = value.trim()
    if (clean.length < 2 || pending) return
    if (!clarification) {
      if (answer && currentQuestion) setMessages((items) => [...items, { question: currentQuestion, answer }])
      setCurrentQuestion(clean)
      setQuestion('')
      setAnswer(null)
    }
    startTransition(async () => {
      try { setAnswer(await askXiaowei(clarification ? currentQuestion : clean, clarification)) }
      catch (error) { toast.error(error instanceof Error ? error.message : '小维暂时无法查询，请稍后重试') }
    })
  }

  const confirmAction = () => {
    const action = answer?.pendingAction
    if (!action || pending) return
    startTransition(async () => {
      try {
        const results = await sendRentalReminders(action.rentalIds)
        const sent = results.filter((result) => result.ok).length
        const failed = results.length - sent
        setAnswer((current) => current ? { ...current, title: failed ? '短信发送完成，部分失败' : '短信发送成功', summary: `成功发送 ${sent} 条${failed ? `，失败 ${failed} 条` : ''}。`, facts: results.map((result) => `${result.contractNo}：${result.ok ? '发送成功' : result.message}`), pendingAction: undefined, updatedAt: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) } : current)
      } catch (error) { toast.error(error instanceof Error ? error.message : '短信发送失败，请稍后重试') }
    })
  }

  const startNewQuestion = () => {
    setQuestion('')
    document.getElementById('xiaowei-question')?.focus()
  }

  const correctAnswer = () => {
    setAnswer(null)
    setCorrecting(true)
    setCatalogOpen(true)
    setCatalogSearch('')
    setActiveCategory('全部')
  }

  const chooseCatalogQuestion = (selected: string) => {
    if (correcting) {
      setCorrecting(false)
      submit(currentQuestion, selected)
      return
    }
    submit(selected)
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="打开小维经营助手" className="flex h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-primary transition-colors hover:bg-primary/15">
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4"/><Sparkles className="absolute -right-1 -top-1 size-3 rounded-full bg-card p-0.5 text-primary"/></span>
      <span className="hidden text-sm font-bold lg:inline">小维</span>
    </button>
    {mounted && open && createPortal(<div className="fixed inset-0 z-[70] flex justify-end pointer-events-none sm:top-16">
      <button type="button" aria-label="关闭小维" className="absolute inset-0 bg-foreground/15 pointer-events-auto sm:hidden" onClick={() => setOpen(false)}/>
      <aside role="dialog" aria-modal="true" aria-labelledby="xiaowei-title" className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden border-border bg-background shadow-2xl sm:w-[440px] sm:border-l sm:shadow-[-12px_0_32px_rgba(15,23,42,0.12)]">
        <header className="flex shrink-0 items-center justify-between border-b bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/15"><Bot className="size-6"/></span><div><h2 id="xiaowei-title" className="font-bold">小维</h2><p className="text-xs text-primary-foreground/75">经营数据助手 · 精确查询，不猜数字</p></div></div>
          <button type="button" aria-label="关闭小维" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-primary-foreground/10"><X className="size-5"/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!answer ? <div className="flex flex-col gap-5">
            <section className="rounded-2xl border bg-card p-5"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5"/></span><div><h3 className="font-bold">你好，我是小维</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">我会直接查询你有权限查看的合同、设备和账单数据，帮你快速了解经营情况。</p></div></div></section>
            {!catalogOpen ? <section><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">常用问题</p><button type="button" onClick={() => setCatalogOpen(true)} className="text-sm font-semibold text-primary">查看全部问题</button></div><div className="flex flex-col gap-2">{commonXiaoweiQuestions.map((item) => <button key={item} type="button" onClick={() => chooseCatalogQuestion(item)} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"><span>{item}</span><ArrowRight className="size-4 text-muted-foreground"/></button>)}</div></section> : <section className="flex flex-col gap-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">全部问题</h3><p className="text-xs text-muted-foreground">按业务分类查找可用问题</p></div><button type="button" onClick={() => { setCatalogOpen(false); setCatalogSearch(''); setActiveCategory('全部') }} className="text-sm font-semibold text-primary">返回常用</button></div><label className="flex h-11 items-center gap-2 rounded-xl border bg-card px-3"><Search className="size-4 text-muted-foreground"/><span className="sr-only">搜索问题</span><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="搜索客户、收款、退租、硬件…" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><div className="flex gap-2 overflow-x-auto pb-1">{['全部', ...xiaoweiQuestionCatalog.map((group) => group.category)].map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${activeCategory === category ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{category}</button>)}</div><div className="flex flex-col gap-5">{xiaoweiQuestionCatalog.filter((group) => activeCategory === '全部' || group.category === activeCategory).map((group) => { const questions = group.questions.filter((item) => !catalogSearch.trim() || item.toLowerCase().includes(catalogSearch.trim().toLowerCase()) || group.category.includes(catalogSearch.trim())); return questions.length ? <div key={group.category}><p className="mb-2 text-xs font-bold text-primary">{group.category}</p><div className="flex flex-col gap-2">{questions.map((item) => <button key={item} type="button" onClick={() => chooseCatalogQuestion(item)} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-left text-sm hover:border-primary/40 hover:bg-primary/5"><span>{item}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground"/></button>)}</div></div> : null })}</div></section>}
          </div> : <div className="flex flex-col gap-4">
            {messages.map((message, index) => <div key={`${message.question}-${index}`} className="flex flex-col gap-3"><div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{message.question}</div><article className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-primary"><Bot className="size-4"/><h3 className="text-sm font-bold">{message.answer.title}</h3></div><p className="mt-2 text-sm font-semibold leading-6">{message.answer.summary}</p></article></div>)}
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">{currentQuestion}</div>
            <article className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-2 text-primary"><Bot className="size-5"/><h3 className="font-bold">{answer.title}</h3></div><p className="mt-3 text-pretty text-base font-semibold leading-7">{answer.summary}</p>{answer.facts.length > 0 && <ul className="mt-4 flex flex-col gap-2">{answer.facts.map((fact) => <li key={fact} className="rounded-xl bg-muted px-3 py-2 text-sm leading-6">{fact}</li>)}</ul>}{answer.pendingAction ? <button type="button" disabled={pending} onClick={confirmAction} className="mt-4 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{pending ? '正在发送…' : answer.pendingAction.label}</button> : null}{answer.suggestions?.length ? <div className="mt-4 flex flex-col gap-2"><p className="text-xs font-semibold text-muted-foreground">请选择最接近的一项</p>{answer.suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={pending} onClick={() => submit(currentQuestion, suggestion)} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2.5 text-left text-sm font-medium hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"><span>{suggestion}</span><ArrowRight className="size-4 shrink-0 text-primary"/></button>)}</div> : null}<div className="mt-4 border-t pt-4"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary"/>{answer.scope}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Database className="size-4 text-primary"/>数据更新时间：{answer.updatedAt}</p><Link href={answer.href} onClick={() => setOpen(false)} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{answer.hrefLabel}<ArrowRight className="size-4"/></Link></div></article>
            {!answer.needsClarification && <div className="flex items-center justify-center gap-4"><button type="button" onClick={correctAnswer} className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline">答非所问，重新选择</button><button type="button" onClick={startNewQuestion} className="text-sm font-semibold text-primary">继续问其他问题</button></div>}
          </div>}
        </div>
        <footer className="shrink-0 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><form onSubmit={(event) => { event.preventDefault(); submit() }} className="flex items-center gap-2"><label htmlFor="xiaowei-question" className="sr-only">询问小维</label><input id="xiaowei-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={200} placeholder="问问本月租赁、设备排行或风险…" className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/><button type="submit" disabled={pending || question.trim().length < 2} aria-label="发送问题" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">{pending ? <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"/> : <Send className="size-4"/>}</button></form><p className="mt-2 text-center text-xs text-muted-foreground">小维只分析系统已有数据，重要决策请人工复核</p></footer>
      </aside>
    </div>, document.body)}
  </>
}
