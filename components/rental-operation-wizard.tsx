'use client'

import { ChevronRight, CircleAlert, X } from 'lucide-react'
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
  refundableDeposit: number
  items: WizardItem[]
  onClose: () => void
  onStart: (type: RentalOperationType) => void
}

export function RentalOperationWizard({ contractNo, customerName, customerPhone, endDate, refundableDeposit, items, onClose, onStart }: Props) {
  const availableItems = items.filter((item) => item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity > 0).length

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="办理租赁业务">
      <div className="flex max-h-[94svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold text-primary">统一业务办理</p>
            <h2 className="mt-1 text-lg font-bold text-balance">选择要办理的业务</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contractNo} · {customerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭业务向导" className="rounded-lg p-2 hover:bg-muted"><X className="size-5" /></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex flex-col gap-5">
            <section className="rounded-xl border bg-card p-4 text-sm">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div><dt className="text-muted-foreground">可办理设备</dt><dd className="mt-1 font-semibold">{availableItems} 项</dd></div>
                <div><dt className="text-muted-foreground">当前到期日</dt><dd className="mt-1 font-semibold">{endDate}</dd></div>
                <div><dt className="text-muted-foreground">客户电话</dt><dd className="mt-1 font-semibold">{customerPhone}</dd></div>
              </dl>
            </section>
            {(['设备处理', '合同与计费', '结算处理'] as const).map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPERATION_DEFINITIONS.filter((item) => item.group === group).map((item) => {
                    const disabled = (item.requiresDevice && availableItems === 0) || (item.type === 'deposit_refund' && refundableDeposit <= 0)
                    const disabledReason = item.type === 'deposit_refund' ? '当前无可退押金' : '当前无可办理设备'
                    return (
                      <button key={item.type} type="button" disabled={disabled} onClick={() => onStart(item.type)} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45">
                        <span><strong className={item.risk === 'destructive' ? 'text-destructive' : ''}>{item.label}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{disabled ? disabledReason : item.description}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            <section className="rounded-xl bg-accent p-4 text-sm leading-6 text-accent-foreground">
              <div className="flex gap-2"><CircleAlert className="mt-1 size-4 shrink-0" /><p>点击业务后直接进入对应表单。原合同、历史账目和业务记录都会保留；提交前仍会再次核对设备、金额和日期。</p></div>
            </section>
          </div>
        </main>

        <footer className="flex items-center justify-between gap-3 border-t p-4 sm:px-5">
          <p className="text-xs text-muted-foreground">可退押金：¥{refundableDeposit.toFixed(2)}</p>
          <button type="button" onClick={onClose} className="h-10 rounded-lg border px-4 text-sm font-medium">关闭</button>
        </footer>
      </div>
    </div>
  )
}
