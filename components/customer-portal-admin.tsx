'use client'

import QRCode from 'qrcode'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ArrowLeft, Ban, CheckCircle2, Clock3, Copy, ExternalLink, LogOut, QrCode, Search, ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { revokeCustomerSessions, setCustomerPortalStatus } from '@/app/actions/customer-portals'
import { userErrorMessage } from '@/lib/errors'

export function CustomerPortalAdmin({ customers }: { customers: any[] }) {
  const [pending, start] = useTransition()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all'|'active'|'paused'>('all')
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState('')
  const [queryUrl] = useState(() => typeof window === 'undefined' ? '/customer-login' : `${window.location.origin}/customer-login`)
  useEffect(() => { if (showQr) QRCode.toDataURL(queryUrl, { width: 320, margin: 2, color: { dark: '#0b6b4b', light: '#ffffff' } }).then(setQr) }, [showQr, queryUrl])
  const filtered = useMemo(() => customers.filter((customer) => {
    const matchesQuery = !query || `${customer.customerName}${customer.customerCompany || ''}${customer.phone}`.toLowerCase().includes(query.toLowerCase())
    const current = customer.portal?.status === 'paused' ? 'paused' : 'active'
    return matchesQuery && (status === 'all' || status === current)
  }), [customers, query, status])
  const stats = {
    total: customers.filter((customer) => customer.activeCount > 0).length,
    active: customers.reduce((sum, customer) => sum + Number(customer.activeCount || 0), 0),
    recent: customers.filter((customer) => customer.portal?.lastLoginAt).length,
    paused: customers.filter((customer) => customer.portal?.status === 'paused').length,
  }
  const copyLink = async () => { await navigator.clipboard.writeText(queryUrl); toast.success('客户查询链接已复制') }
  const changeStatus = (customer: any, next: 'active'|'paused') => start(async () => { try { await setCustomerPortalStatus(customer.phone, next); toast.success(next === 'paused' ? '已暂停该客户查询，现有会话已注销' : '已恢复客户查询') } catch (error) { toast.error(userErrorMessage(error)) } })
  const revoke = (customer: any) => start(async () => { try { await revokeCustomerSessions(customer.phone); toast.success('客户当前登录会话已注销') } catch (error) { toast.error(userErrorMessage(error)) } })

  return <main className="min-h-svh bg-background p-4 md:p-6"><div className="mx-auto flex max-w-6xl flex-col gap-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-sm font-medium text-primary">客户服务</p><h1 className="mt-1 text-2xl font-bold text-balance">客户查询与访问管理</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">客户使用合同手机号和短信验证码即可自助查询，无需手动开户。您可以在这里管理访问状态和登录会话。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={copyLink} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted"><Copy className="size-4"/>复制查询链接</button><button type="button" onClick={() => setShowQr(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"><QrCode className="size-4"/>通用查询码</button><Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-muted"><ArrowLeft className="size-4"/>返回总览</Link></div></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      [Users, '可查询客户', stats.total], [CheckCircle2, '有效在租合同', stats.active], [Clock3, '已有登录记录', stats.recent], [Ban, '已暂停查询', stats.paused],
    ].map(([Icon, label, value]: any) => <article key={label} className="rounded-2xl border bg-card p-4"><Icon className="size-5 text-primary"/><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></article>)}</section>
    <section className="rounded-2xl border bg-card p-4"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><span className="sr-only">搜索客户</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、公司或手机号" className="h-10 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"/></label><div className="flex gap-2">{(['all','active','paused'] as const).map((item) => <button type="button" key={item} onClick={() => setStatus(item)} className={`h-10 rounded-xl px-4 text-sm font-medium ${status === item ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}>{item === 'all' ? '全部' : item === 'active' ? '可查询' : '已暂停'}</button>)}</div></div></section>
    <section className="grid gap-3">{filtered.map((customer) => { const paused = customer.portal?.status === 'paused'; return <article key={customer.phone} className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-4 lg:flex-row lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{customer.customerName}{customer.customerCompany ? ` · ${customer.customerCompany}` : ''}</h2><span className={`rounded-full px-2 py-1 text-xs font-medium ${paused ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>{paused ? '已暂停' : '可查询'}</span>{customer.hasSession && <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">当前有会话</span>}</div><p className="mt-2 text-sm text-muted-foreground">{customer.phone.slice(0,3)}****{customer.phone.slice(-4)} · {customer.contractCount} 份合同 · {customer.activeCount} 份有效在租</p><p className="mt-1 text-xs text-muted-foreground">{customer.portal?.lastLoginAt ? `最近验证：${new Date(customer.portal.lastLoginAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}` : '尚未通过短信验证登录'}</p></div><div className="flex flex-wrap gap-2">{customer.hasSession && <button disabled={pending} onClick={() => revoke(customer)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"><LogOut className="size-4"/>注销会话</button>}<button disabled={pending} onClick={() => changeStatus(customer, paused ? 'active' : 'paused')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${paused ? 'bg-primary text-primary-foreground' : 'border border-destructive text-destructive'}`}>{paused ? <CheckCircle2 className="size-4"/> : <Ban className="size-4"/>}{paused ? '恢复查询' : '暂停查询'}</button></div></article>})}{!filtered.length && <div className="rounded-2xl border border-dashed bg-card p-10 text-center"><ShieldCheck className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-medium">没有符合条件的客户</p><p className="mt-1 text-sm text-muted-foreground">客户有有效租赁合同后会自动出现在这里。</p></div>}</section>
  </div>{showQr && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setShowQr(false)}><div role="dialog" aria-modal="true" aria-labelledby="query-qr-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 id="query-qr-title" className="text-lg font-bold">客户通用查询码</h2><p className="mt-1 text-sm text-muted-foreground">所有客户扫码后输入合同手机号和验证码查询。</p></div><button type="button" onClick={() => setShowQr(false)} className="rounded-lg border px-3 py-1 text-sm">关闭</button></div>{qr && <img src={qr} alt="客户自助查询二维码" className="mx-auto mt-5 size-64 rounded-xl border"/>}<a href="/customer-login" target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">打开客户查询页<ExternalLink className="size-4"/></a></div></div>}</main>
}
