'use client'

import { useState } from 'react'
import { ArrowRight, ChevronRight, X } from 'lucide-react'
import { OPERATION_DEFINITIONS, type RentalOperationType } from '@/lib/rental-operation-hub'

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
  customerPhone: string
  endDate: string
  items: WizardItem[]
  onClose: () => void
  onStart: (type: RentalOperationType) => void
  embedded?: boolean
}

export function RentalOperationWizard({ contractNo, customerName, customerPhone, endDate, items, onClose, onStart, embedded = false }: Props) {
  const [type, setType] = useState<RentalOperationType | null>(null)
  const availableItems = items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0).length

  return (
    <div
      className={embedded ? "flex min-h-[calc(100svh-11rem)] w-full flex-col" : "fixed inset-0 z-[70] flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4"}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-label="办理租赁业务"
    >
      <div className={embedded ? "flex min-h-0 w-full flex-1 flex-col" : "flex max-h-[94svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl"}>
        <header className={`flex items-start justify-between gap-4 border-b ${embedded ? "pb-4" : "p-4 sm:p-5"}`}>
          <div>
            <p className="text-xs font-semibold text-primary">统一业务办理</p>
            <h2 className="mt-1 text-lg font-bold text-balance">选择要办理的业务</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contractNo} · {customerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭业务向导" className="rounded-lg p-2 hover:bg-muted"><X className="size-5" /></button>
        </header>

        <main className={embedded ? "min-h-0 flex-1 py-5" : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"}>
          <div className="flex flex-col gap-5">
            <section className="rounded-xl border bg-card p-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div><dt className="text-muted-foreground">可办理设备</dt><dd className="mt-1 font-semibold">{availableItems} 项</dd></div>
                <div><dt className="text-muted-foreground">当前到期日</dt><dd className="mt-1 font-semibold">{endDate}</dd></div>
                <div><dt className="text-muted-foreground">客户电话</dt><dd className="mt-1 font-semibold">{customerPhone}</dd></div>
              </dl>
            </section>
            {(['设备流转', '合同调整', '售后服务'] as const).map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPERATION_DEFINITIONS.filter((item) => item.group === group).map((item) => (
                    <button key={item.type} type="button" onClick={() => setType(item.type)} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${type === item.type ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/50'}`}>
                      <span><strong className={item.risk === 'destructive' ? 'text-destructive' : ''}>{item.label}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            ))}

          </div>
        </main>

        <footer className={`sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur ${embedded ? "" : "px-4 sm:px-5"}`}>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border px-4 text-sm font-medium">{embedded ? "返回合同详情" : "取消"}</button>
          <button type="button" disabled={!type} onClick={() => type && onStart(type)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40">进入业务表单<ArrowRight className="size-4" /></button>
        </footer>
      </div>
    </div>
  )
}
