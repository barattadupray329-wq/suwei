'use client'

import { CheckCircle2, MessageSquareText, X } from 'lucide-react'
import type { XiaoweiSmsPreview } from '@/app/actions/xiaowei'

type Props = {
  preview: XiaoweiSmsPreview
  sending: boolean
  cancelled: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function XiaoweiSmsConfirmation({ preview, sending, cancelled, onConfirm, onCancel }: Props) {
  if (cancelled) {
    return <div className="mt-4 flex items-center gap-2 rounded-xl border bg-muted px-3 py-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4"/>此短信操作已处理</div>
  }

  return <section className="mt-4 overflow-hidden rounded-xl border border-primary/25 bg-primary/5" aria-label="短信发送确认">
    <div className="flex items-start gap-3 border-b border-primary/15 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><MessageSquareText className="size-5"/></span>
      <div><p className="text-sm font-bold">到期提醒短信</p><p className="mt-1 text-xs text-muted-foreground">{preview.customerName} · {preview.maskedPhone}</p></div>
    </div>
    <div className="grid gap-2 p-4">
      {preview.contracts.map((contract) => <div key={contract.id} className="rounded-lg bg-card px-3 py-2 text-xs leading-5">
        <p className="font-semibold">{contract.contractNo}</p>
        <p className="text-muted-foreground">{contract.overdue ? '已逾期' : '即将到期'} · {contract.endDate} · 未归还 {contract.remainingQuantity} 台</p>
      </div>)}
    </div>
    <div className="flex gap-2 border-t border-primary/15 p-3">
      <button type="button" onClick={onCancel} disabled={sending} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border bg-card text-sm font-semibold disabled:opacity-50"><X className="size-4"/>取消</button>
      <button type="button" onClick={onConfirm} disabled={sending} className="inline-flex h-9 flex-[2] items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? '正在发送…' : '确认发送短信'}</button>
    </div>
  </section>
}
