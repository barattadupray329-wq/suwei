'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { importDraftRentals, type RentalAssignee } from '@/app/actions/rentals'
import { DRAFT_IMPORT_COLUMNS, DRAFT_IMPORT_LIMIT, draftTemplateRows, parseDraftImport } from '@/lib/draft-import'
import { createCsv } from '@/lib/csv'

function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url) }

export function DraftImport({ assignees }: { assignees: RentalAssignee[] }) {
  const router = useRouter(); const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(''); const [fileName, setFileName] = useState(''); const [assigneeUserId, setAssigneeUserId] = useState(assignees[0]?.id ?? ''); const [pending, start] = useTransition()
  const parsed = useMemo(() => text.trim() ? parseDraftImport(text) : null, [text])
  const validRows = parsed?.rows.filter((row) => row.value) ?? []; const invalidRows = parsed?.rows.filter((row) => row.errors.length) ?? []

  const downloadCsvTemplate = () => downloadBlob(new Blob([createCsv(DRAFT_IMPORT_COLUMNS.map((c) => c.required ? `${c.label}*` : c.label), draftTemplateRows())], { type: 'text/csv;charset=utf-8' }), '草稿多设备导入模板.csv')
  const downloadExcelTemplate = async () => {
    const XLSX = await import('xlsx'); const book = XLSX.utils.book_new()
    const data = [DRAFT_IMPORT_COLUMNS.map((c) => c.required ? `${c.label}*` : c.label), ...draftTemplateRows()]
    const sheet = XLSX.utils.aoa_to_sheet(data); sheet['!cols'] = DRAFT_IMPORT_COLUMNS.map((c) => ({ wch: Math.max(12, c.label.length * 2 + 4) }))
    const guide = XLSX.utils.aoa_to_sheet([['草稿多设备导入说明'], ['1. 相同“合同标识”的连续或非连续行会合并为一份草稿合同。'], ['2. 客户、租期、押金等合同字段仅填写该合同第一行；每行填写一项设备。'], ['3. 标有 * 的列必填；单次最多 200 个设备行。'], ['4. 导入前会按合同整体校验；任一设备行错误时整份合同不会导入。']])
    XLSX.utils.book_append_sheet(book, sheet, '导入数据'); XLSX.utils.book_append_sheet(book, guide, '填写说明'); XLSX.writeFile(book, '草稿多设备导入模板.xlsx')
  }
  const readFile = async (file: File) => {
    try {
      if (/\.xlsx?$/i.test(file.name)) { const XLSX = await import('xlsx'); const book = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const sheet = book.Sheets[book.SheetNames[0]]; setText(XLSX.utils.sheet_to_csv(sheet)) } else setText(await file.text())
      setFileName(file.name)
    } catch { setFileName(''); toast.error('文件读取失败，请确认文件格式正确，或复制表格内容粘贴导入') }
  }
  const downloadErrors = () => {
    if (!invalidRows.length) return
    const rows = invalidRows.map((row) => [row.contractKey, row.lines.join('、'), row.raw.customerName ?? '', row.errors.join('；')])
    downloadBlob(new Blob([createCsv(['合同标识', '源文件行号', '客户姓名', '错误原因'], rows)], { type: 'text/csv;charset=utf-8' }), '草稿导入错误报告.csv')
  }
  const submit = () => {
    if (!validRows.length) return toast.error('没有可导入的有效合同')
    if (invalidRows.length && !window.confirm(`发现 ${invalidRows.length} 份错误合同。是否跳过错误合同，仅导入 ${validRows.length} 份有效合同？`)) return
    start(async () => {
      const result = await importDraftRentals({ assigneeUserId: assigneeUserId || undefined, rows: validRows.map((row) => ({ ...row.value!, contractNo: '' })) })
      if (!result.ok) { toast.error(result.message); return }
      const { succeeded, failed } = result.data!; if (failed.length) toast.warning(`成功 ${succeeded.length} 份，失败 ${failed.length} 份：${failed[0].message}`); else toast.success(`已导入 ${succeeded.length} 份草稿合同`)
      if (succeeded.length) router.push('/rentals/drafts')
    })
  }
  const clear = () => { setText(''); setFileName(''); if (fileInput.current) fileInput.current.value = '' }

  return <div className="flex flex-col gap-4">
    <section className="surface"><div className="surface-content flex flex-col gap-5">
      <div className="flex flex-col gap-1"><h1 className="text-lg font-semibold text-balance">草稿批量导入工作台</h1><p className="text-sm leading-relaxed text-muted-foreground">支持 CSV、XLSX 和 Excel/WPS 复制粘贴。相同合同标识的多行设备会合并为一份草稿，单次最多 {DRAFT_IMPORT_LIMIT} 个设备行。</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void downloadExcelTemplate()} className="primary-button"><Download data-icon="inline-start" />下载 Excel 模板</button>
        <button type="button" onClick={downloadCsvTemplate} className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium"><Download data-icon="inline-start" />CSV 模板</button>
        <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium"><Upload data-icon="inline-start" />上传文件</button>
        <input ref={fileInput} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" aria-label="上传 CSV 或 Excel 文件" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file) }} />
        {fileName && <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><FileSpreadsheet />{fileName}</span>}
      </div>
      <label className="flex flex-col gap-2"><span className="text-sm font-medium">粘贴表格数据（含表头）</span><textarea value={text} onChange={(e) => { setText(e.target.value); setFileName('') }} rows={8} placeholder={`${DRAFT_IMPORT_COLUMNS.map((c) => c.label).join('\t')}\nHT001\t张三\t13800138000\t...`} className="w-full rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed" /></label>
      {assignees.length > 1 && <label className="flex max-w-sm flex-col gap-2"><span className="text-sm font-medium">维护负责人</span><select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm">{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </div></section>

    {parsed && <section className="surface"><div className="surface-content flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">合同级导入预览</h2><p className="text-sm text-muted-foreground">共解析 {parsed.sourceRowCount} 个设备行，合并为 {parsed.rows.length} 份合同</p></div><div className="flex gap-3 text-sm"><span className="flex items-center gap-1"><CheckCircle2 />有效 {validRows.length}</span>{invalidRows.length > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle />错误 {invalidRows.length}</span>}</div></div>
      {parsed.missing.length > 0 && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">缺少必填列：{parsed.missing.join('、')}</div>}
      {parsed.truncated && <div className="rounded-lg bg-muted p-3 text-sm">超过 {DRAFT_IMPORT_LIMIT} 个设备行，仅预览前 {DRAFT_IMPORT_LIMIT} 行。</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">合同标识</th><th className="p-3">客户</th><th className="p-3">设备</th><th className="p-3">租期 / 金额</th><th className="p-3">校验结果</th></tr></thead><tbody>{parsed.rows.map((row) => <tr key={row.contractKey} className="border-t align-top"><td className="p-3 font-mono">{row.contractKey}<div className="text-xs text-muted-foreground">第 {row.lines.join('、')} 行</div></td><td className="p-3">{row.raw.customerName || '—'}<div className="text-xs text-muted-foreground">{row.raw.customerPhone || '—'}</div></td><td className="p-3">{row.value?.items.length ?? row.lines.length} 项<div className="text-xs text-muted-foreground">{row.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? '—'} 台</div></td><td className="p-3">{row.value ? `${row.value.duration}${row.value.billingType === 'daily' ? '天' : '个月'}` : '—'}<div className="text-xs text-muted-foreground">{row.value ? `${row.value.items.reduce((sum, item) => sum + item.totalRent, 0).toFixed(2)} 元` : '—'}</div></td><td className="max-w-72 p-3 leading-relaxed">{row.errors.length ? <span className="text-destructive">{row.errors.join('；')}</span> : <span className="text-muted-foreground">通过</span>}</td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={pending || !validRows.length} onClick={submit} className="primary-button disabled:opacity-50">{pending ? '正在导入…' : `确认导入 ${validRows.length} 份有效合同`}</button>{invalidRows.length > 0 && <button type="button" onClick={downloadErrors} className="rounded-lg border bg-background px-4 py-2 text-sm font-medium"><Download data-icon="inline-start" />下载错误报告</button>}<button type="button" onClick={clear} className="rounded-lg border bg-background px-4 py-2 text-sm font-medium">清空</button></div>
    </div></section>}

    <section className="surface"><div className="surface-content flex flex-col gap-3"><h2 className="font-semibold">字段说明</h2><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-2">列名</th><th className="p-2">要求</th><th className="p-2">说明</th></tr></thead><tbody>{DRAFT_IMPORT_COLUMNS.map((column) => <tr key={column.key} className="border-t"><td className="p-2 font-medium">{column.label}</td><td className="p-2">{column.required ? '必填' : '选填'}</td><td className="p-2 text-muted-foreground">{column.hint}</td></tr>)}</tbody></table></div></div></section>
  </div>
}
