'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CalendarRange, CheckCircle2, Cloud, Database, Download, FileSpreadsheet, HardDriveDownload, Info, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'

type BackupCenterProps = {
  storeName: string
  version: string
  counts: { contracts: number; devices: number; payments: number; members: number }
  lastUpdated: string | null
}

export function BackupCenter({ storeName, version, counts, lastUpdated }: BackupCenterProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showRestore, setShowRestore] = useState(false)
  const [snapshots, setSnapshots] = useState<Array<{id:number;backupType:string;recordCount:number;checksum:string;createdAt:string}>>([])
  const [restorePayload, setRestorePayload] = useState<unknown>(null)
  const [preview, setPreview] = useState<{createdAt:string;recordCount:number;checksum:string;counts:Record<string,number>}|null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [restoring, setRestoring] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadSnapshots = () => fetch('/api/backups').then(response => response.json()).then(data => setSnapshots(data.snapshots || [])).catch(() => undefined)
  useEffect(() => { loadSnapshots() }, [])

  async function createCloudBackup() {
    setBusyAction('working')
    try { const response = await fetch('/api/backups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'manual'}) }); const body=await response.json(); if(!response.ok)throw new Error(body.error); await loadSnapshots(); toast.success('云端恢复快照已创建') } catch(error){toast.error(error instanceof Error?error.message:'备份失败')} finally{setBusyAction(null)}
  }
  async function inspectBackup(file: File) {
    try { const payload=JSON.parse(await file.text()); const response=await fetch('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'preview',payload})}); const body=await response.json(); if(!response.ok)throw new Error(body.error); setRestorePayload(payload);setPreview(body.summary);setConfirmation('');toast.success('备份预检通过') } catch(error){setRestorePayload(null);setPreview(null);toast.error(error instanceof Error?error.message:'备份文件无效')}
  }
  async function confirmRestore(){if(!restorePayload)return;setRestoring(true);try{const response=await fetch('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'restore',payload:restorePayload,confirmation})});const body=await response.json();if(!response.ok)throw new Error(body.error);toast.success(`已恢复 ${body.restored.recordCount} 条记录`);setPreview(null);setRestorePayload(null);setConfirmation('');await loadSnapshots()}catch(error){const raw=error instanceof Error?error.message:'';toast.error(raw.includes('toISOString')?'备份中的时间字段格式不正确，恢复已停止，现有数据未被修改':raw||'恢复失败，现有数据未被修改')}finally{setRestoring(false)}}

  async function downloadFile(endpoint: string, filename: string, success: string) {
    setBusyAction('working')
    try {
      const response = await fetch(endpoint)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || '导出失败')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setBusyAction(null)
    }
  }

  async function downloadExport() {
    if (from && to && from > to) return toast.error('开始日期不能晚于结束日期')
    setBusyAction('working')
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const response = await fetch(`/api/exports/business?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || '导出失败')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${storeName.replace(/[\\/:*?"<>|]/g, '-')}租赁数据-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Excel 数据包已下载')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setBusyAction(null)
    }
  }

  return <main className="min-h-svh bg-background p-4 md:p-6">
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/" className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回经营总览</Link>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><HardDriveDownload className="size-5" /></span><div><h1 className="text-2xl font-bold text-balance">版本与备份中心</h1><p className="text-sm text-muted-foreground">升级前检查、业务数据导出与版本信息</p></div></div>
        <span className="self-start rounded-full border bg-card px-3 py-1.5 font-mono text-sm">v{version}</span>
      </header>

      <section className="rounded-xl border bg-card p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="size-5"/></span><div><p className="font-semibold">数据保护运行正常</p><p className="mt-1 text-sm leading-6 text-muted-foreground">系统工作期间每 30 分钟生成云端快照，安全退出时还会下载 JSON 恢复包和 Excel 留档。</p><p className="mt-1 text-xs text-muted-foreground">{snapshots[0]?`最近快照：${new Date(snapshots[0].createdAt).toLocaleString('zh-CN',{hour12:false})} · ${snapshots[0].recordCount} 条记录`:'尚无云端快照，建议立即创建首次备份'}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={createCloudBackup} disabled={busyAction!==null} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-60">{busyAction==='working'?<RefreshCw className="size-4 animate-spin"/>:<Cloud className="size-4"/>}立即云备份</button><button type="button" onClick={()=>downloadFile('/api/backups?download=json',`rental-backup-${new Date().toISOString().slice(0,10)}.json`,'JSON 恢复包已下载')} disabled={busyAction!==null} className="inline-flex h-11 items-center gap-2 rounded-lg border bg-background px-5 font-medium disabled:opacity-60"><Download className="size-4"/>下载恢复包</button></div></div></section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-primary">管理员数据备份</p><h2 className="mt-1 text-xl font-bold text-balance">导出完整 Excel 数据包</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">每类业务数据单独工作表，包含合同、设备、收款、续租、买断、退租、丢失和员工账号。导出严格限制为当前公司数据。</p></div><FileSpreadsheet className="size-8 text-primary" /></div>
          <button type="button" onClick={()=>setShowFilters(value=>!value)} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary"><CalendarRange className="size-4"/>{showFilters?'收起日期筛选':'按日期筛选（可选）'}</button>{showFilters&&<div className="mt-3 rounded-xl bg-muted p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm">开始日期<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border bg-background px-3" /></label><label className="flex flex-col gap-2 text-sm">结束日期<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border bg-background px-3" /></label></div><p className="mt-3 text-xs text-muted-foreground">不填写日期表示全量导出。</p></div>}
          <button type="button" onClick={downloadExport} disabled={busyAction !== null} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-60">{busyAction !== null ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}{busyAction !== null ? '正在生成数据包' : '下载 Excel 备份'}</button>
        </article>

        <article className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><Database className="size-5 text-primary" /><h2 className="font-semibold">当前数据概览</h2></div><div className="mt-4 grid grid-cols-2 gap-3">{[['合同', counts.contracts], ['设备明细', counts.devices], ['收款记录', counts.payments], ['员工账号', counts.members]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">业务最近更新：{lastUpdated ? new Date(lastUpdated).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '暂无业务数据'}</p></article>
      </section>

      <section className="rounded-xl border bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-primary">员工常用表格</p><h2 className="mt-1 text-xl font-bold text-balance">导出租机明细全表</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">左侧保留员工熟悉的旧表列和顺序，右侧附带合同编号、客户电话、计费方式、押金等软件匹配字段；自动拆分在租与历史清单。</p></div><button type="button" onClick={()=>downloadFile('/api/exports/rental-ledger',`${storeName.replace(/[\\/:*?\"<>|]/g,'-')}租机明细全表-${new Date().toISOString().slice(0,10)}.xlsx`,'员工租机明细表已下载')} disabled={busyAction !== null} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border bg-background px-5 font-medium hover:bg-muted disabled:opacity-60"><FileSpreadsheet className="size-4"/>下载员工明细表</button></div></section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><Cloud className="size-5 text-primary"/><h2 className="font-semibold">可恢复云端快照</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">完整 JSON 快照保存在 Neon，并按当前公司隔离。系统工作台打开期间会定时备份，安全退出前也会再创建一次。</p><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">最近 {snapshots.length} 个保护点</p><button type="button" onClick={loadSnapshots} className="inline-flex items-center gap-1 text-xs text-primary"><RefreshCw className="size-3"/>刷新列表</button></div><div className="mt-4 flex max-h-52 flex-col gap-2 overflow-y-auto">{snapshots.map(snapshot=><div key={snapshot.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm"><span><strong>{snapshot.backupType==='pre-restore'?'恢复前保护点':snapshot.backupType==='exit'?'安全退出':'云端备份'}</strong><span className="block text-xs text-muted-foreground">{new Date(snapshot.createdAt).toLocaleString('zh-CN',{hour12:false})} · {snapshot.recordCount} 条</span></span><code className="hidden text-xs text-muted-foreground sm:block">{snapshot.checksum.slice(0,10)}</code></div>)}{!snapshots.length&&<p className="text-sm text-muted-foreground">暂无云端快照</p>}</div></article>
        <article className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><Upload className="size-5 text-primary"/><h2 className="font-semibold">数据恢复</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">仅在系统故障或升级异常时使用。恢复前会预检，并自动保存当前数据保护点。</p><button type="button" onClick={()=>setShowRestore(value=>!value)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border px-4 font-medium">{showRestore?'取消恢复':'展开恢复工具'}</button>{showRestore&&<div className="mt-4 border-t pt-4"><div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-primary"/><p>恢复会替换当前公司数据。必须先选择文件完成预检，再输入确认文字。</p></div><input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={event=>{const file=event.target.files?.[0];if(file)void inspectBackup(file)}}/><button type="button" onClick={()=>fileRef.current?.click()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border px-4 font-medium"><Upload className="size-4"/>第一步：选择恢复包并预检</button>{preview&&<div className="mt-4 rounded-xl border border-primary bg-primary/5 p-4"><p className="font-medium">预检通过：{preview.recordCount} 条记录</p><p className="mt-1 text-xs text-muted-foreground">备份时间 {new Date(preview.createdAt).toLocaleString('zh-CN',{hour12:false})} · 校验 {preview.checksum.slice(0,16)}</p><label className="mt-4 flex flex-col gap-2 text-sm font-medium">输入“确认恢复”<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} className="h-10 rounded-lg border bg-background px-3"/></label><button type="button" onClick={confirmRestore} disabled={restoring||confirmation!=='确认恢复'} className="mt-3 h-10 rounded-lg bg-destructive px-4 font-medium text-destructive-foreground disabled:opacity-50">{restoring?'正在恢复并校验':'第三步：全量恢复数据'}</button></div>}</div>}</article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-semibold">升级前安全检查</h2></div><div className="mt-4 flex flex-col gap-3">{['先下载最新 Excel 数据包并妥善保存', '在 Preview 环境完成合同、收款和权限测试', '数据库结构变更只使用向前兼容迁移', '确认无误后再将版本提升到 Production'].map((item) => <div key={item} className="flex items-start gap-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{item}</span></div>)}</div></article>
        <article className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><Info className="size-5 text-primary" /><h2 className="font-semibold">关于备份与升级</h2></div><div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-muted-foreground"><p>Excel 导出用于业务查阅和离线留档，不等同于可直接恢复数据库的快照。</p><p>网站升级由 Vercel 发布流程完成，本页面不会保存部署令牌，也不会在后台自动改动生产环境。</p><p>普通页面更新和重新部署不会清空 Neon 数据；涉及数据库结构时仍应先备份再升级。</p></div></article>
      </section>

      <section className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><RefreshCw className="size-5 text-primary" /><h2 className="font-semibold">本版本更新</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Update title="安全数据导出" text="按公司隔离导出八类业务数据，过滤认证机密并防止 Excel 公式注入。" /><Update title="升级检查中心" text="集中展示版本、数据规模和升级前安全步骤，降低误操作风险。" /><Update title="经营体验优化" text="修复设备配置乱码，补充分页和更准确的合同状态统计。" /></div></section>
    </div>
  </main>
}

function Update({ title, text }: { title: string; text: string }) { return <div className="rounded-lg bg-muted p-4"><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div> }
