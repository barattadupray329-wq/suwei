'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, CircleAlert, X } from 'lucide-react'
import { OPERATION_DEFINITIONS, availableOperationQuantity, operationWarnings, type RentalOperationType } from '@/lib/rental-operation-hub'

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
}

const steps = ['选择业务', '选择设备', '结算与通知', '确认影响']

export function RentalOperationWizard({ contractNo, customerName, customerPhone, endDate, items, onClose, onStart }: Props) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<RentalOperationType | null>(null)
  const [itemId, setItemId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [sendSms, setSendSms] = useState(true)
  const definition = OPERATION_DEFINITIONS.find((item) => item.type === type)
  const selectedItem = items.find((item) => item.id === itemId)
  const available = selectedItem ? availableOperationQuantity(selectedItem) : 0
  const amountPreview = selectedItem ? selectedItem.monthlyRent * quantity : 0
  const warnings = useMemo(() => type ? operationWarnings({ type, quantity, availableQuantity: available, amountDelta: amountPreview, sendSms: sendSms && Boolean(definition?.smsScene), phone: customerPhone }) : [], [type, quantity, available, amountPreview, sendSms, customerPhone, definition?.smsScene])

  const nextDisabled = (step === 0 && !type) || (step === 1 && definition?.requiresDevice && (!selectedItem || quantity < 1 || quantity > available))
  const advance = () => {
    if (step === 0 && definition && !definition.requiresDevice) setStep(2)
    else setStep((value) => Math.min(3, value + 1))
  }
  const back = () => {
    if (step === 2 && definition && !definition.requiresDevice) setStep(0)
    else setStep((value) => Math.max(0, value - 1))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="办理租赁业务">
      <div className="flex h-[94svh] max-h-[94svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:h-[min(720px,94svh)] sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold text-primary">统一业务办理</p>
            <h2 className="mt-1 text-lg font-bold">{definition?.label || '选择要办理的业务'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{contractNo} · {customerName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭业务向导" className="rounded-lg p-2 hover:bg-muted"><X className="size-5" /></button>
        </header>

        <nav aria-label="办理进度" className="grid shrink-0 grid-cols-4 border-b bg-muted/50 px-3 sm:px-5">
          {steps.map((label, index) => (
            <div key={label} className={`border-b-2 py-3 text-center text-xs font-medium sm:text-sm ${index === step ? 'border-primary text-primary' : index < step ? 'border-transparent text-foreground' : 'border-transparent text-muted-foreground'}`}>
              <span className="hidden sm:inline">{index + 1}. </span>{label}
            </div>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              {(['设备流转', '合同调整', '售后服务'] as const).map((group) => (
                <section key={group}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{group}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {OPERATION_DEFINITIONS.filter((item) => item.group === group).map((item) => (
                      <button key={item.type} type="button" onClick={() => { setType(item.type); setItemId(null); }} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${type === item.type ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/50'}`}>
                        <span><strong className={item.risk === 'destructive' ? 'text-destructive' : ''}>{item.label}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {step === 1 && definition?.requiresDevice && (
            <div className="flex flex-col gap-3">
              <div><h3 className="font-semibold">选择本次操作的设备</h3><p className="mt-1 text-sm text-muted-foreground">只展示仍可操作的设备，数量已自动扣除买断、退租和丢失。</p></div>
              {items.map((item) => {
                const count = availableOperationQuantity(item)
                return (
                  <button key={item.id} type="button" disabled={count === 0} onClick={() => { setItemId(item.id); setQuantity(1); }} className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-45 ${itemId === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between gap-3"><strong>{item.name}</strong><span className="text-sm font-semibold text-primary">可操作 {count} 台</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.code || '未编号'} · 月租 ¥{item.monthlyRent.toLocaleString('zh-CN')}</p>
                  </button>
                )
              })}
              {selectedItem && <label className="rounded-xl bg-muted p-4 text-sm"><span className="font-medium">本次数量</span><input type="number" min={1} max={available} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="ml-3 h-10 w-24 rounded-lg border bg-background px-3" /><span className="ml-2 text-muted-foreground">最多 {available} 台</span></label>}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border p-4"><h3 className="font-semibold">结算方式将在下一步业务表单中填写</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">系统会根据业务类型计算应收、即时收付款和押金变化；提交前还会再次显示最终金额。</p></section>
              {definition?.smsScene ? <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} className="mt-1 size-4 accent-primary" /><span><strong>业务完成后发送短信</strong><span className="mt-1 block text-sm text-muted-foreground">接收人 {customerName} · {customerPhone}</span></span></label> : <section className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">该业务暂无客户短信，操作记录仍会完整保存。</section>}
            </div>
          )}

          {step === 3 && definition && (
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" /><h3 className="font-semibold">请核对本次业务范围</h3></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">业务类型</dt><dd className="mt-1 font-semibold">{definition.label}</dd></div><div><dt className="text-muted-foreground">合同当前到期日</dt><dd className="mt-1 font-semibold">{endDate}</dd></div>{selectedItem && <><div><dt className="text-muted-foreground">操作设备</dt><dd className="mt-1 font-semibold">{selectedItem.name}</dd></div><div><dt className="text-muted-foreground">操作数量</dt><dd className="mt-1 font-semibold">{quantity} 台</dd></div></>}<div><dt className="text-muted-foreground">客户通知</dt><dd className="mt-1 font-semibold">{definition.smsScene && sendSms ? `发送至 ${customerPhone}` : '不发送'}</dd></div></dl></section>
              <section className="rounded-xl bg-accent p-4 text-sm leading-6 text-accent-foreground"><strong>下一步：</strong>进入“{definition.label}”专用表单填写金额、日期和处理说明；系统会在最终提交前展示准确的账务与设备变化。</section>
              {warnings.map((warning) => <p key={warning} className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{warning}</p>)}
            </div>
          )}
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t p-4 sm:px-5">
          <button type="button" onClick={step === 0 ? onClose : back} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium"><ArrowLeft className="size-4" />{step === 0 ? '取消' : '上一步'}</button>
          {step < 3 ? <button type="button" disabled={nextDisabled} onClick={advance} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40">下一步<ArrowRight className="size-4" /></button> : <button type="button" disabled={!type || warnings.some((warning) => warning.includes('最多只能') || warning.includes('请选择至少'))} onClick={() => type && onStart(type)} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40">进入业务表单</button>}
        </footer>
      </div>
    </div>
  )
}
