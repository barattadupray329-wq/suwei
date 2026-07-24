import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`page-container ${className}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, description, actions, backHref }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; backHref?: string }) {
  return <header className="page-header">
    <div className="flex min-w-0 items-start gap-3">
      {backHref && <Link href={backHref} aria-label="返回" className="icon-button mt-0.5"><ArrowLeft /></Link>}
      <div className="min-w-0">{eyebrow && <p className="page-eyebrow">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
}

export function Section({ title, description, actions, children, className = '' }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{(title || description || actions) && <div className="surface-header"><div>{title && <h2 className="surface-title">{title}</h2>}{description && <p className="surface-description">{description}</p>}</div>{actions}</div>}<div className="surface-content">{children}</div></section>
}

export function StatCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: string; icon?: ReactNode }) {
  return <div className="stat-card"><div className="flex items-start justify-between gap-3"><p className="stat-label">{label}</p>{icon && <span className="stat-icon">{icon}</span>}</div><p className="stat-value">{value}</p>{detail && <p className="stat-detail">{detail}</p>}</div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>
}
