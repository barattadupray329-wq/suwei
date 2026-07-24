import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Phone } from 'lucide-react'
import type { PublicBusiness } from '@/lib/public-business'

export function LegalDocument({ title, updated, business, children }: { title: string; updated: string; business: PublicBusiness; children: React.ReactNode }) {
  return <main className="min-h-svh bg-background px-4 py-8 md:py-12">
    <article className="mx-auto flex max-w-3xl flex-col gap-6 rounded-xl border bg-card p-5 shadow-sm md:p-8">
      <Link href="/customer-login" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回客户服务中心</Link>
      <header className="flex flex-col gap-2 border-b pb-6"><p className="text-sm font-medium text-primary">{business.storeName}</p><h1 className="text-3xl font-bold text-balance">{title}</h1><p className="text-sm text-muted-foreground">更新日期：{updated}</p></header>
      {!business.configured ? <aside className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6 text-destructive"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>经营主体或联系电话尚未在业务设置中补齐。正式上线前必须由管理员填写真实、准确的信息。</p></aside> : null}
      <div className="legal-content flex flex-col gap-6 text-sm leading-7 text-foreground">{children}</div>
      <footer className="flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground"><strong className="text-foreground">经营者：{business.lessorName || '待管理员配置'}</strong><span>联系负责人：{business.contactName}</span>{business.phone ? <a className="inline-flex items-center gap-2 text-primary" href={`tel:${business.phone}`}><Phone className="size-4" />{business.phone}</a> : <span>联系电话：待管理员配置</span>}{business.address ? <span>联系地址：{business.address}</span> : null}</footer>
    </article>
  </main>
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-2"><h2 className="text-lg font-bold text-balance">{title}</h2><div className="flex flex-col gap-2 text-muted-foreground">{children}</div></section>
}
