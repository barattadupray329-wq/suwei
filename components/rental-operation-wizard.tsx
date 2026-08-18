'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert, Sparkles, X } from 'lucide-react'
import {
  OPERATION_GROUPS,
  availableOperationEntries,
  operationPrinciple,
  recommendedOperation,
  type OperationIntent,
  type RentalOperationType,
} from '@/lib/rental-operation-hub'

// 业务中心只负责引导，最终可办理性仍由对应服务端业务校验。
type WizardItem = {
  id: number
  name: string
  code?: string | null
  quantity: number
  boughtOutQuantity: number
  returnedQuantity: number
  lostQuantity: number
  monthlyRent: number
}

type Props = {
  contractNo: string
  customerName: string
  endDate: string
  outstandingAmount: number
  refundableDeposit: number
  items: WizardItem[]
  onClose: () => void
  onStart: (type: RentalOperationType, intent?: OperationIntent) => void
}

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function RentalOperationWizard({ contractNo, customerName, endDate, outstandingAmount, refundableDeposit, items, onClose, onStart }: Props) {
  const availableItems = items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0).length
  const entries = useMemo(() => availableOperationEntries({ availableItems, refundableDeposit }), [availableItems, refundableDeposit])
  const recommendation = recommendedOperation({ endDate, availableItems })
  const defaultEntry = entries.find((entry) => entry.key === recommendation?.key) ?? entries.find((entry) => !entry.disabled) ?? entries[0]
  const [activeKey, setActiveKey] = useState(defaultEntry?.key ?? '')
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? defaultEntry

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5" role="region" aria-labelledby="operation-wizard-title">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <header className="flex items-start justify-between gap-4 border-b p-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">业务办理中心</p>
            <h2 id="operation-wizard-title" className="mt-1 text-xl font-bold text-balance">您想为这份合同做什么？</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{contractNo} · {customerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭业务办理中心" className="shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"><X className="size-5" /></button>
        </header>

        <main className="p-4 sm:p-6">
          <div className="flex flex-col gap-5">
            <section aria-label="合同办理摘要" className="rounded-xl border bg-card p-4">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">剩余设备</dt><dd className="mt-1 font-semibold">{availableItems} 项</dd></div>
                <div><dt className="text-muted-foreground">当前到期日</dt><dd className="mt-1 font-semibold">{endDate}</dd></div>
                <div><dt className="text-muted-foreground">当前待收</dt><dd className="mt-1 font-semibold">{money(outstandingAmount)}</dd></div>
                <div><dt className="text-muted-foreground">可退押金</dt><dd className="mt-1 font-semibold">{money(refundableDeposit)}</dd></div>
              </dl>
            </section>

            {recommendation && (
              <section className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="建议办理">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-primary">建议办理：办理续租</p>
                  <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
                </div>
                <button type="button" onClick={() => onStart('renewal')} className="shrink-0 text-sm font-semibold text-primary hover:underline">直接办理</button>
              </section>
            )}

            {OPERATION_GROUPS.map((group) => (
              <section key={group} aria-labelledby={`operation-group-${group}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id={`operation-group-${group}`} className="text-sm font-semibold">{group}</h3>
                  {group === '常用业务' && <span className="text-xs text-muted-foreground">高频操作优先展示</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {entries.filter((entry) => entry.group === group).map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={entry.disabled}
                      onFocus={() => setActiveKey(entry.key)}
                      onMouseEnter={() => setActiveKey(entry.key)}
                      onClick={() => onStart(entry.type, entry.intent)}
                      className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <strong className={entry.risk === 'destructive' ? 'text-destructive' : ''}>{entry.label}</strong>
                          {entry.key === recommendation?.key && <CheckCircle2 className="size-4 text-primary" aria-label="建议办理" />}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{entry.disabled ? entry.disabledReason : entry.description}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {activeEntry && (
              <section className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm leading-6" aria-live="polite">
                <CircleAlert className="mt-1 size-4 shrink-0 text-primary" />
                <p><strong>{activeEntry.label}：</strong>{operationPrinciple(activeEntry)}</p>
              </section>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">选择业务后进入核对表单，不会立即提交</p>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted">关闭</button>
        </footer>
      </div>
    </section>
  )
}
