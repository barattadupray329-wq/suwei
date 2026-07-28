'use client'

import { ChevronRight, CircleAlert, X } from 'lucide-react'
import { OPERATION_DEFINITIONS, availableOperationQuantity, type OperationDefinition, type RentalOperationType } from '@/lib/rental-operation-hub'

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
  onStart: (type: RentalOperationType, selectedItemIds?: number[]) => void
}

const groups: OperationDefinition['group'][] = ['常用办理', '设备服务', '合同资料', '谨慎操作']

const groupDescriptions: Record<OperationDefinition['group'], string> = {
  常用办理: '高频业务直达专用表单，编号默认全选，可按需取消。',
  设备服务: '根据设备实际情况记录维修或完成换机。',
  合同资料: '低风险资料调整，不经过无意义的多步确认。',
  谨慎操作: '会永久改变设备状态，提交前必须认真复核。',
}

export function RentalOperationWizard({ contractNo, customerName, items, onClose, onStart }: Props) {
  const availableCount = items.reduce((sum, item) => sum + availableOperationQuantity(item), 0)
  const hasOperationalDevice = availableCount > 0

  const unavailableReason = (definition: OperationDefinition) => {
    if (definition.requiresDevice && !hasOperationalDevice) return '当前合同没有可办理的在租设备'
    return ''
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="operation-hub-title">
      <div className="flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold text-primary">按业务风险智能办理</p>
            <h2 id="operation-hub-title" className="mt-1 text-xl font-bold text-balance">选择要办理的业务</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contractNo} · {customerName} · 当前可办理 {availableCount} 台</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭业务办理中心" className="rounded-lg p-2 hover:bg-muted"><X /></button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex flex-col gap-6">
            {groups.map((group) => {
              const definitions = OPERATION_DEFINITIONS.filter((item) => item.group === group)
              return (
                <section key={group} className="flex flex-col gap-3">
                  <div>
                    <h3 className={group === '谨慎操作' ? 'font-semibold text-destructive' : 'font-semibold'}>{group}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{groupDescriptions[group]}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {definitions.map((definition) => {
                      const reason = unavailableReason(definition)
                      const disabled = Boolean(reason)
                      return (
                        <button
                          key={definition.type}
                          type="button"
                          disabled={disabled}
                          onClick={() => onStart(definition.type, definition.type === 'renewal' ? items.filter((item) => availableOperationQuantity(item) > 0).map((item) => item.id) : undefined)}
                          className="group flex min-h-28 items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <strong className={definition.risk === 'destructive' ? 'text-destructive' : ''}>{definition.label}</strong>
                              <span className={definition.flow === 'strict' ? 'rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive' : 'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'}>{definition.flowLabel}</span>
                            </span>
                            <span className="mt-2 block text-sm leading-5 text-muted-foreground">{definition.description}</span>
                            <span className="mt-2 block text-xs font-medium text-foreground">{reason || definition.result}</span>
                          </span>
                          <ChevronRight className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
            <aside className="flex gap-3 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">
              <CircleAlert className="mt-0.5 shrink-0" />
              <p>系统会按业务风险决定确认强度：简单业务直接填写，涉及金额需核对，永久状态变化保留严格复核。</p>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}
