'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { importDraftRentals, type RentalAssignee } from '@/app/actions/rentals'
import { DRAFT_IMPORT_COLUMNS, DRAFT_IMPORT_LIMIT, draftTemplateRows, parseDraftImport } from '@/lib/draft-import'
import { createCsv } from '@/lib/csv'

export function DraftImport({ assignees }: { assignees: RentalAssignee[] }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState(assignees[0]?.id ?? '')
  const [pending, start] = useTransition()

  const parsed = useMemo(() => (text.trim() ? parseDraftImport(text) : null), [text])
  const validRows = parsed?.rows.filter((row) => row.value) ?? []
  const invalidRows = parsed?.rows.filter((row) => row.errors.length) ?? []

  const downloadTemplate = () => {
    const csv = createCsv(DRAFT_IMPORT_COLUMNS.map((column) => (column.required ? `${column.label}*` : column.label)), draftTemplateRows())
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = '草稿批量导入模板.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const readFile = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      toast.error('Excel 文件请先在表格软件里另存为 CSV，或直接复制单元格粘贴到下方文本框')
      return
    }
    setFileName(file.name)
    setText(await file.text())
  }

  const submit = () => {
    if (!validRows.length) { toast.error('没有可导入的有效数据'); return }
    start(async () => {
      const result = await importDraftRentals({
        assigneeUserId: assigneeUserId || undefined,
        rows: validRows.map((row) => ({ ...row.value!, contractNo: '' })),
      })
      if (!result.ok) { toast.error(result.message); return }
      const { succeeded, failed } = result.data!
      if (failed.length) toast.warning(`成功导入 ${succeeded.length} 条，${failed.length} 条失败：${failed[0].message}`)
      else toast.success(`已导入 ${succeeded.length} 条草稿，请到草稿审核页核对后转正式`)
      if (succeeded.length) {
        setText('')
        setFileName('')
        if (fileInput.current) fileInput.current.value = ''
        router.push('/rentals/drafts')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="surface">
        <div className="surface-content flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">批量导入草稿</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">草稿不计入经营与财务数据，导入后需在草稿审核页逐条核对再转为正式合同。单次最多 {DRAFT_IMPORT_LIMIT} 行，每行对应一份单设备合同。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium">
              <Download className="size-4" />下载 CSV 模板
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium">
              <Upload className="size-4" />上传 CSV 文件
            </button>
            <input ref={fileInput} type="file" accept=".csv,.txt,.tsv,text/csv" className="hidden" aria-label="上传 CSV 文件" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file) }} />
            {fileName && <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><FileSpreadsheet className="size-4" />{fileName}</span>}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">从 Excel / WPS 复制单元格后直接粘贴（含表头行）</span>
            <textarea
              value={text}
              onChange={(event) => { setText(event.target.value); setFileName('') }}
              rows={8}
              placeholder={`${DRAFT_IMPORT_COLUMNS.map((column) => column.label).join('\t')}\n张三\t13800138000\t...`}
              className="w-full rounded-lg border bg-background p-3 font-mono text-xs leading-relaxed"
            />
          </label>
          {assignees.length > 1 && (
            <label className="flex flex-col gap-2 sm:max-w-xs">
              <span className="text-sm font-medium">维护负责人</span>
              <select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm">
                {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="surface">
        <div className="surface-content flex flex-col gap-3">
          <h2 className="text-base font-semibold">列说明</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground"><tr><th className="p-2">列名</th><th className="p-2">是否必填</th><th className="p-2">填写说明</th></tr></thead>
              <tbody>
                {DRAFT_IMPORT_COLUMNS.map((column) => (
                  <tr key={column.key} className="border-t">
                    <td className="p-2 font-medium">{column.label}</td>
                    <td className="p-2">{column.required ? '必填' : '选填'}</td>
                    <td className="p-2 text-muted-foreground">{column.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {parsed && (
        <section className="surface">
          <div className="surface-content flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">导入预览</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="size-4" />可导入 {validRows.length} 行</span>
                {invalidRows.length > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-4" />待修正 {invalidRows.length} 行</span>}
              </div>
            </div>
            {parsed.missing.length > 0 && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">缺少必填列：{parsed.missing.join('、')}。请使用模板表头，或检查首行是否为表头。</p>}
            {parsed.truncated && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">数据超过 {DRAFT_IMPORT_LIMIT} 行，仅解析前 {DRAFT_IMPORT_LIMIT} 行，其余请分批导入。</p>}
            {parsed.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-muted text-muted-foreground"><tr><th className="p-2">行号</th><th className="p-2">客户</th><th className="p-2">设备</th><th className="p-2">租期</th><th className="p-2">金额</th><th className="p-2">校验</th></tr></thead>
                  <tbody>
                    {parsed.rows.map((row) => {
                      const item = row.value?.items[0]
                      return (
                        <tr key={row.line} className="border-t align-top">
                          <td className="p-2 text-muted-foreground">{row.line}</td>
                          <td className="p-2"><div className="font-medium">{row.raw.customerName || '—'}</div><div className="text-xs text-muted-foreground">{row.raw.customerPhone || '—'}{row.raw.customerCompany ? ` · ${row.raw.customerCompany}` : ''}</div></td>
                          <td className="p-2">{item ? `${item.deviceName || item.deviceType} × ${item.quantity}` : `${row.raw.deviceName || row.raw.deviceType || '—'} × ${row.raw.quantity || '—'}`}</td>
                          <td className="p-2">{row.value ? `${row.value.startDate} 起 ${row.value.duration}${row.value.billingType === 'daily' ? '天' : '个月'}，至 ${row.value.endDate}` : `${row.raw.startDate || '—'} / ${row.raw.duration || '—'}`}</td>
                          <td className="p-2">{row.value ? `${row.value.items[0].totalRent.toFixed(2)} 元` : '—'}</td>
                          <td className="p-2">{row.errors.length ? <span className="text-destructive">{row.errors.join('；')}</span> : <span className="text-muted-foreground">通过</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || !validRows.length} onClick={submit} className="primary-button disabled:opacity-50">
                {pending ? '正在导入…' : `导入 ${validRows.length} 条草稿`}
              </button>
              <button type="button" onClick={() => { setText(''); setFileName(''); if (fileInput.current) fileInput.current.value = '' }} className="rounded-lg border bg-background px-4 py-2 text-sm font-medium">清空</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
