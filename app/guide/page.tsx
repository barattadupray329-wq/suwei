import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardPenLine } from 'lucide-react'
import { auth } from '@/lib/auth'

const scenarios = [
  { title: '客户少要几台或全部不要', use: '设备已经录入，但客户临时减少数量或提前终止。', steps: ['打开经营总览并进入对应合同', '点击“办理租赁变更”', '选择“客户少要或全部不要设备”', '选择设备、数量和实际退租日期', '人工填写减免或退款差额并确认'], result: '设备按退租日期结束，原合同和原收款保留，差额单独记录。' },
  { title: '客户要换电脑或换配置', use: '原设备需要换成另一台，或 CPU、内存、显卡、租金发生变化。', steps: ['整台更换选择“客户要更换电脑或配置”后进入换机', '仅配置变化选择“配置/租金变更”', '填写生效日期、变更原因和费用差额', '核对变更前后配置再提交'], result: '系统保存旧配置和新配置，账上只新增差额，不重写历史金额。' },
  { title: '租赁时间延长或缩短', use: '客户续租、提前结束，或者原先录错到期日。', steps: ['续租设备使用“办理续租”', '整体缩短或改日期使用“租期缩短或整体日期更换”', '填写新到期日和生效日期', '人工确认补收或减免金额'], result: '当前有效到期日更新，原到期日留在变更记录中。' },
  { title: '联系人姓名或电话更换', use: '后续通知对象变化，但不能修改已经签订合同上的历史资料。', steps: ['选择“姓名或电话号码更换”', '填写新的联系人和手机号', '填写生效日期与原因', '勾选客户是否已经确认后提交'], result: '后续联系使用新资料；签约时的合同快照仍显示原姓名和电话。' },
  { title: '合同录错了怎么办', use: '区分尚未履约的纯测试记录和已经开始履约的正式合同。', steps: ['无收款、无履约、无业务记录的测试合同可由管理员删除', '已经履约的合同不得删除', '正式合同按实际情况办理退租、日期调整或资料变更', '金额录错使用冲正，不直接覆盖收款'], result: '业务链条完整可查，月底对账不会出现合同或款项凭空消失。' },
]

export default async function GuidePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  return <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 md:p-8">
    <header className="flex flex-col gap-4 rounded-2xl border bg-card p-6 md:p-8">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ClipboardPenLine className="size-5" /></span>
      <div><p className="text-sm font-semibold text-primary">操作员工作手册</p><h1 className="mt-2 text-balance text-3xl font-bold tracking-tight">客户临时变更时，应该怎么做账？</h1><p className="mt-3 max-w-3xl text-pretty leading-relaxed text-muted-foreground">记住一个原则：正式合同不删除、不覆盖。每次变化都办理一张变更记录，原租金、费用差额和实际收退款分开记录。</p></div>
      <Link href="/dashboard" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">回到经营总览 <ArrowRight className="size-4" /></Link>
    </header>
    <section className="grid gap-3 md:grid-cols-3">
      {['先选真实情境', '再核对费用差额', '最后确认并留痕'].map((item, index) => <div key={item} className="rounded-xl bg-muted p-4"><span className="text-sm font-semibold text-primary">第 {index + 1} 步</span><p className="mt-1 font-semibold">{item}</p></div>)}
    </section>
    <div className="flex flex-col gap-4">{scenarios.map((scenario) => <article key={scenario.title} className="rounded-2xl border bg-card p-5 md:p-6"><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div className="max-w-2xl"><h2 className="text-xl font-bold">{scenario.title}</h2><p className="mt-2 leading-relaxed text-muted-foreground">适用情况：{scenario.use}</p><ol className="mt-4 flex flex-col gap-2">{scenario.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span>{step}</span></li>)}</ol></div><div className="h-fit rounded-xl border border-primary/30 bg-primary/5 p-4 md:max-w-xs"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" />完成后会怎样</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{scenario.result}</p></div></div></article>)}</div>
    <aside className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"><CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" /><div><h2 className="font-bold">禁止的做法</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">不要删除已经履约的合同，不要为了对上金额直接改原收款，不要用新手机号覆盖签约合同快照。发现操作错误时，应新增冲正或纠正记录。</p></div></aside>
  </div>
}
