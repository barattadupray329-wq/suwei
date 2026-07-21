'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  addMember,
  changeOwnPassword,
  resetMemberPassword,
  reviewAdminApplication,
  updateMember,
  updateMemberName,
  updateOwnName,
} from '@/app/actions/business'

const PERMISSIONS = ['租赁操作', '资金查看', '合同管理', '账号管理', '系统设置']

type Account = {
  id: string
  name: string
  email: string
  createdAt?: Date | string
  updatedAt?: Date | string
}

type Member = Account & {
  role: string
  active: boolean
  permissions: string
}

type Application = { id: number; name: string; email: string; phone: string; status: string; createdAt: Date | string }

export function AccountManagement({ data }: { data: { owner: Account[]; members: Member[]; applications: Application[]; currentRole: 'super_admin' | 'admin' } }) {
  const owner = data.owner[0]
  return (
    <main className="min-h-svh bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/dashboard" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          返回经营总览
        </Link>
        <header className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Users className="size-5" />
          </span>
          <div>
            <h1 className="text-balance text-2xl font-bold">账号管理</h1>
            <p className="text-pretty text-sm text-muted-foreground">维护账号资料、登录密码、员工权限与启用状态</p>
          </div>
        </header>

        {owner ? <OwnerSection owner={owner} role={data.currentRole} /> : null}
        {data.currentRole === 'super_admin' ? <ApplicationSection applications={data.applications} /> : null}
        <AddMemberSection />

        <section className="flex flex-col gap-4" aria-labelledby="member-accounts-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="member-accounts-title" className="text-lg font-semibold">员工账号</h2>
              <p className="text-sm text-muted-foreground">共 {data.members.length} 位员工，账号停用后会立即退出登录。</p>
            </div>
          </div>
          {data.members.length ? (
            <div className="grid gap-4">
              {data.members.map((member) => <MemberCard key={member.id} member={member} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center">
              <Users className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">还没有员工账号</p>
              <p className="mt-1 text-sm text-muted-foreground">请通过上方表单创建首个员工账号并分配权限。</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function OwnerSection({ owner, role }: { owner: Account; role: 'super_admin' | 'admin' }) {
  const router = useRouter()
  const [profilePending, startProfile] = useTransition()
  const [passwordPending, startPassword] = useTransition()
  const [name, setName] = useState(owner.name)
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="my-account-title">
      <div className="flex items-center gap-3 border-b p-5">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
        <div>
          <h2 id="my-account-title" className="font-semibold">我的管理员账号</h2>
          <p className="text-sm text-muted-foreground">修改姓名或使用当前密码更新登录密码。</p>
        </div>
        <span className="ml-auto hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:inline-flex">{role === 'super_admin' ? '超级管理员' : '管理员'} · 正常</span>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <form className="flex flex-col gap-4" aria-busy={profilePending} onSubmit={(event) => {
          event.preventDefault()
          startProfile(async () => {
            try {
              await updateOwnName(name)
              toast.success('管理员姓名已更新')
              router.refresh()
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '姓名保存失败')
            }
          })
        }}>
          <div>
            <h3 className="font-medium">基本资料</h3>
            <p className="mt-1 text-sm text-muted-foreground">登录邮箱不可在此修改。</p>
          </div>
          <Field label="姓名" value={name} onChange={setName} autoComplete="name" />
          <Field label="登录邮箱" value={owner.email} readOnly />
          <button disabled={profilePending || name.trim() === owner.name} className="h-10 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {profilePending ? '正在保存…' : '保存资料'}
          </button>
        </form>

        <form className="flex flex-col gap-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-busy={passwordPending} onSubmit={(event) => {
          event.preventDefault()
          startPassword(async () => {
            try {
              await changeOwnPassword(passwords)
              setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
              toast.success('密码已修改，其他设备已退出登录')
              router.refresh()
            } catch (error) {
              toast.error(error instanceof Error ? error.message : '密码修改失败')
            }
          })
        }}>
          <div>
            <h3 className="font-medium">修改密码</h3>
            <p className="mt-1 text-sm text-muted-foreground">新密码至少 8 位，修改后其他设备将退出登录。</p>
          </div>
          <PasswordField label="当前密码" value={passwords.currentPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setPasswords((state) => ({ ...state, currentPassword: value }))} autoComplete="current-password" />
          <PasswordField label="新密码" value={passwords.newPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setPasswords((state) => ({ ...state, newPassword: value }))} autoComplete="new-password" />
          <PasswordField label="确认新密码" value={passwords.confirmPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setPasswords((state) => ({ ...state, confirmPassword: value }))} autoComplete="new-password" />
          <button disabled={passwordPending || !passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword} className="h-10 self-start rounded-lg border border-primary px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
            {passwordPending ? '正在修改…' : '修改密码'}
          </button>
        </form>
      </div>
    </section>
  )
}

function ApplicationSection({ applications }: { applications: Application[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const review = async (id: number, decision: 'approve' | 'reject') => {
    if (!window.confirm(decision === 'approve' ? '确认批准该管理员申请吗？批准后对方可登录并创建员工。' : '确认拒绝该管理员申请吗？')) return
    setPendingId(id)
    try { await reviewAdminApplication(id, decision); toast.success(decision === 'approve' ? '管理员申请已批准' : '管理员申请已拒绝'); router.refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : '申请处理失败') }
    finally { setPendingId(null) }
  }
  return <section className="rounded-xl border bg-card p-5" aria-labelledby="applications-title"><div><h2 id="applications-title" className="font-semibold">管理员申请审核</h2><p className="text-sm text-muted-foreground">只有超级管理员可以批准管理员。审核前申请人不能登录。</p></div><div className="mt-4 grid gap-3">{applications.length ? applications.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.email} · {item.phone}</p><p className="mt-1 text-xs text-muted-foreground">申请时间：{formatDate(item.createdAt)}</p></div><div className="flex gap-2"><button disabled={pendingId === item.id} onClick={() => review(item.id, 'reject')} className="h-9 rounded-lg border px-3 text-sm font-medium disabled:opacity-50">拒绝</button><button disabled={pendingId === item.id} onClick={() => review(item.id, 'approve')} className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">批准为管理员</button></div></article>) : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">当前没有待审核的管理员申请。</p>}</div></section>
}

function AddMemberSection() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [selected, setSelected] = useState<string[]>(['租赁操作'])
  const [showPassword, setShowPassword] = useState(false)

  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="add-member-title">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserPlus className="size-5" /></span>
        <div>
          <h2 id="add-member-title" className="font-semibold">创建员工账号</h2>
          <p className="text-sm text-muted-foreground">创建员工登录账号，并根据岗位分配可使用的业务功能。</p>
        </div>
      </div>
      <form className="mt-5 flex flex-col gap-4" aria-busy={pending} onSubmit={(event) => {
        event.preventDefault()
        start(async () => {
          try {
            await addMember({ ...form, permissions: selected })
            setForm({ name: '', email: '', password: '', confirmPassword: '' })
            setSelected(['租赁操作'])
            toast.success('员工账号已创建，请安全告知员工临时密码')
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : '员工账号创建失败')
          }
        })
      }}>
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <Field label="员工姓名" value={form.name} onChange={(name) => setForm((value) => ({ ...value, name }))} autoComplete="off" placeholder="请输入员工姓名" />
          <Field label="登录邮箱" value={form.email} onChange={(email) => setForm((value) => ({ ...value, email }))} type="email" autoComplete="off" placeholder="name@example.com" />
          <PasswordField label="临时密码" value={form.password} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(password) => setForm((value) => ({ ...value, password }))} autoComplete="new-password" />
          <PasswordField label="确认临时密码" value={form.confirmPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(confirmPassword) => setForm((value) => ({ ...value, confirmPassword }))} autoComplete="new-password" />
        </div>
        <PermissionPicker selected={selected} onChange={setSelected} />
        <button disabled={pending || !form.name || !form.email || !form.password || !form.confirmPassword || selected.length === 0} className="h-10 self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? '正在创建…' : '创建员工账号'}
        </button>
      </form>
    </section>
  )
}

function MemberCard({ member }: { member: Member }) {
  const router = useRouter()
  const [namePending, startName] = useTransition()
  const [accessPending, startAccess] = useTransition()
  const [passwordPending, startPassword] = useTransition()
  const [name, setName] = useState(member.name)
  const [selected, setSelected] = useState(member.permissions.split(',').filter(Boolean))
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' })
  const [showReset, setShowReset] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const saveAccess = (active: boolean) => startAccess(async () => {
    if (active === false && !window.confirm(`确认停用 ${member.name} 的账号吗？该员工会立即退出登录。`)) return
    try {
      await updateMember(member.id, { active, permissions: selected })
      toast.success(active === member.active ? '员工权限已保存' : active ? '员工账号已启用' : '员工账号已停用')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '账号设置保存失败')
    }
  })

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{member.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${member.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{member.active ? '正常' : '已停用'}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-2 text-xs text-muted-foreground">最近设置：{formatDate(member.updatedAt)}</p>
        </div>
        <button disabled={accessPending} onClick={() => saveAccess(!member.active)} className={`h-9 self-start rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${member.active ? 'border text-foreground hover:bg-muted' : 'bg-primary text-primary-foreground'}`}>
          {accessPending ? '处理中…' : member.active ? '停用账号' : '启用账号'}
        </button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="text-sm font-semibold">员工资料</h4>
            <p className="mt-1 text-sm text-muted-foreground">修改员工在系统中显示的姓名。</p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={(event) => {
            event.preventDefault()
            startName(async () => {
              try {
                await updateMemberName(member.id, name)
                toast.success('员工姓名已更新')
                router.refresh()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '姓名保存失败')
              }
            })
          }}>
            <Field label="姓名" value={name} onChange={setName} autoComplete="off" />
            <button disabled={namePending || name.trim() === member.name} className="h-9 self-start rounded-lg border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">{namePending ? '正在保存…' : '保存姓名'}</button>
          </form>
          <button onClick={() => setShowReset((value) => !value)} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"><KeyRound className="size-4" />{showReset ? '取消重置密码' : '重置员工密码'}</button>
          {showReset ? (
            <form className="flex flex-col gap-3 rounded-lg bg-muted p-4" onSubmit={(event) => {
              event.preventDefault()
              if (!window.confirm(`确认重置 ${member.name} 的登录密码吗？其当前登录会话将全部失效。`)) return
              startPassword(async () => {
                try {
                  await resetMemberPassword(member.id, passwords)
                  setPasswords({ newPassword: '', confirmPassword: '' })
                  setShowReset(false)
                  toast.success('员工密码已重置，原密码已失效')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : '密码重置失败')
                }
              })
            }}>
              <p className="text-sm font-medium">设置临时登录密码</p>
              <PasswordField label="新密码" value={passwords.newPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setPasswords((state) => ({ ...state, newPassword: value }))} autoComplete="new-password" />
              <PasswordField label="确认新密码" value={passwords.confirmPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} onChange={(value) => setPasswords((state) => ({ ...state, confirmPassword: value }))} autoComplete="new-password" />
              <button disabled={passwordPending || !passwords.newPassword || !passwords.confirmPassword} className="h-9 self-start rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{passwordPending ? '正在重置…' : '确认重置密码'}</button>
            </form>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <h4 className="text-sm font-semibold">工作权限</h4>
            <p className="mt-1 text-sm text-muted-foreground">选择该员工负责的工作范围，未选择的功能不会显示。</p>
          </div>
          <PermissionPicker selected={selected} onChange={setSelected} />
          <button disabled={accessPending || selected.length === 0} onClick={() => saveAccess(member.active)} className="inline-flex h-9 self-start items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-4" />{accessPending ? '正在保存…' : '保存权限'}</button>
        </div>
      </div>
    </article>
  )
}

function PermissionPicker({ selected, onChange }: { selected: string[]; onChange: (permissions: string[]) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">模块权限</legend>
      <div className="flex flex-wrap gap-2">
        {PERMISSIONS.map((permission) => (
          <label key={permission} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected.includes(permission) ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-muted'}`}>
            <input type="checkbox" className="accent-primary" checked={selected.includes(permission)} onChange={() => onChange(selected.includes(permission) ? selected.filter((item) => item !== permission) : [...selected, permission])} />
            {permission}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Field({ label, value, onChange, readOnly = false, type = 'text', autoComplete, placeholder }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean; type?: string; autoComplete?: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input type={type} value={value} readOnly={readOnly} autoComplete={autoComplete} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal outline-none transition-shadow focus:ring-2 focus:ring-ring read-only:cursor-not-allowed read-only:bg-muted read-only:text-muted-foreground" />
    </label>
  )
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete }: { label: string; value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void; autoComplete: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <span className="relative">
        <input required minLength={8} maxLength={128} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 pr-10 font-normal outline-none transition-shadow focus:ring-2 focus:ring-ring" />
        <button type="button" onClick={onToggle} aria-label={show ? '隐藏密码' : '显示密码'} className="absolute right-0 top-0 flex size-10 items-center justify-center text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  )
}

function formatDate(value?: Date | string) {
  if (!value) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
