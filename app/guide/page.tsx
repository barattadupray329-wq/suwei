import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowRight, CheckCircle2, CircleAlert, ClipboardPenLine } from 'lucide-react'
import { auth } from '@/lib/auth'

type Block = { id: string; title: string; intro: string; cases: { when: string; how: string[]; note: string }[] }

const sections: Block[] = [
  {
    id: 'overview',
    title: '一、系统概述与登录',
    intro: '速维租赁管理面向门店操作员，分为对外官网、员工工作台和客户查询端三部分。登录后按账号权限显示可用功能。',
    cases: [
      { when: '员工要进入工作台', how: ['打开登录页，选择“账号密码”', '输入管理员分配的账号和密码', '首次登录后建议尽快修改初始密码'], note: '员工账号由管理员创建；账号被停用会立即退出登录。' },
      { when: '忘记或需要修改密码', how: ['在登录页点击“修改或忘记密码”', '输入账号和绑定手机号获取短信验证码', '填写验证码并设置新密码'], note: '密码至少 8 位，修改后其他设备会退出登录。' },
    ],
  },
  {
    id: 'dashboard',
    title: '二、经营总览与租赁合同',
    intro: '经营总览是日常主界面，用于登记合同、录入设备、收款和办理各类变更。',
    cases: [
      { when: '新增一份租赁合同', how: ['在经营总览点击新增合同', '填写客户、联系人、手机号等资料', '逐台录入设备名称、配置和月租', '确认租期与首期收款后保存'], note: '合同一旦开始履约就不能删除，只能通过变更记录调整。' },
      { when: '登记一笔收款', how: ['进入对应合同', '选择收款类型与支付方式', '填写实际收款金额和日期'], note: '金额录错请用冲正记录，不要直接覆盖原收款。' },
    ],
  },
  {
    id: 'rental-change',
    title: '三、租赁变更（做账核心）',
    intro: '记住一个原则：正式合同不删除、不覆盖。每次变化都办理一张变更记录，原租金、费用差额与实际收退款分开记录。',
    cases: [
      { when: '客户少要几台或全部不要', how: ['进入对应合同点击“办理租赁变更”', '选择“客户少要或全部不要设备”', '选择设备、数量和实际退租日期', '人工填写减免或退款差额并确认'], note: '设备按退租日期结束，原合同和原收款保留，差额单独记录。' },
      { when: '客户要换电脑或换配置', how: ['整台更换选择“客户要更换电脑或配置”', '仅配置变化选择“配置/租金变更”', '填写生效日期、原因和费用差额', '核对变更前后配置再提交'], note: '系统保存新旧配置，账上只新增差额，不重写历史金额。' },
      { when: '租赁时间延长或缩短', how: ['续租使用“办理续租”', '整体缩短或改日期使用“租期缩短或整体日期更换”', '填写新到期日与生效日期', '人工确认补收或减免金额'], note: '当前有效到期日更新，原到期日留在变更记录中。' },
      { when: '联系人姓名或电话更换', how: ['选择“姓名或电话号码更换”', '填写新的联系人和手机号', '填写生效日期与原因', '勾选客户是否已确认后提交'], note: '后续联系使用新资料；签约时的合同快照仍显示原姓名和电话。' },
      { when: '合同录错了怎么办', how: ['无收款、无履约的测试合同可由管理员删除', '已履约合同不得删除', '正式合同按实际办理退租、日期调整或资料变更', '金额录错使用冲正'], note: '业务链条完整可查，月底对账不会出现合同或款项凭空消失。' },
    ],
  },
  {
    id: 'finance',
    title: '四、资金流水与对账',
    intro: '资金流水集中展示每一笔收款，可按类型、支付方式和日期筛选，便于财务核对与客户跟进。',
    cases: [
      { when: '核对某段时间的收款', how: ['进入资金流水', '设置日期范围与款项类型', '按客户或合同搜索定位记录'], note: '每笔资金都能追溯到合同和客户，点击合同号可跳转详情。' },
      { when: '导出账目留档', how: ['进入数据备份的“导出与留档”', '选择业务数据归档并按需设置日期', '下载文件线下保存'], note: '导出仅供查阅留档，正式恢复请使用完整业务备份。' },
    ],
  },
  {
    id: 'sms',
    title: '五、短信提醒与验证码',
    intro: '短信用于客户查询登录和密码重置，验证码 5 分钟内有效。',
    cases: [
      { when: '客户收不到验证码', how: ['确认手机号与合同登记一致', '让客户在倒计时结束后重新获取', '检查是否被拦截或欠费'], note: '无有效在租记录的手机号不会收到任何数据，属于正常保护。' },
    ],
  },
  {
    id: 'customer',
    title: '六、客户查询端管理',
    intro: '客户使用合同手机号加短信验证码自助查询本人在租信息，无需手动开户。',
    cases: [
      { when: '把查询入口发给客户', how: ['进入客户服务', '复制查询链接或展示通用查询码', '发送给客户或张贴在门店'], note: '客户只能查看本人当前在租信息，无法看到其他客户数据。' },
      { when: '暂停或恢复某客户查询', how: ['在客户服务列表找到该客户', '点击“暂停查询”或“恢复查询”', '必要时注销其当前登录会话'], note: '暂停后该客户现有会话会立即失效。' },
    ],
  },
  {
    id: 'accounts',
    title: '七、账号与权限',
    intro: '管理员可创建员工账号并按岗位分配功能权限，也可登记普通客户。',
    cases: [
      { when: '新增员工并授权', how: ['进入账号与权限', '填写姓名、登录账号、手机号和临时密码', '勾选该员工可使用的功能', '保存后安全告知员工临时密码'], note: '权限包括租赁操作、资金查看、合同管理、账号管理和系统设置。' },
      { when: '停用离职员工', how: ['在员工列表找到对应账号', '点击停用', '确认后账号立即退出登录'], note: '停用不会删除历史记录，业务仍可追溯。' },
    ],
  },
  {
    id: 'settings',
    title: '八、业务设置',
    intro: '维护店铺名称、出租方合同资料以及界面外观。',
    cases: [
      { when: '补齐合同出租方资料', how: ['进入业务设置', '填写主体类型、名称、证件号、联系人和收款信息', '保存后合同与法律页面会自动引用'], note: '店铺名称用于管理界面，与合同出租方名称相互独立。' },
      { when: '切换主题外观', how: ['在业务设置选择主题模式与主色', '保存即时生效'], note: '外观仅影响显示，不改变任何业务数据。' },
    ],
  },
  {
    id: 'audit',
    title: '九、业务记录（审计）',
    intro: '业务记录留存关键操作，便于事后追溯与核查。',
    cases: [
      { when: '排查某笔操作是谁做的', how: ['进入业务记录', '按时间或关键字查找', '查看操作人、时间和内容'], note: '记录只读，不可修改，确保可追溯性。' },
    ],
  },
  {
    id: 'backup',
    title: '十、数据备份与恢复',
    intro: '系统每日自动备份并保留最近若干次，重要调整前也可手动备份。',
    cases: [
      { when: '重要调整前先备份', how: ['进入数据备份', '点击“立即创建云备份”', '同时下载一份完整业务备份保存'], note: '完整业务备份用于整体恢复，请妥善保管。' },
      { when: '数据异常需要恢复', how: ['进入数据备份的恢复流程', '上传完整业务备份并检查内容', '核对后确认恢复'], note: '恢复属于高风险操作，执行前系统会先保存现有数据。' },
    ],
  },
]

export default async function GuidePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  return <div className="page-container">
    <header className="page-header">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ClipboardPenLine className="size-5" /></span>
        <div><p className="page-eyebrow">项目说明书</p><h1 className="page-title">速维租赁操作说明书</h1><p className="page-description">按业务模块整理“什么情况→怎么做→注意事项”。第一次使用可按顺序阅读，遇到具体问题可用下方目录快速跳转。</p></div>
      </div>
      <div className="page-actions"><Link href="/dashboard" className="primary-button">回到经营总览 <ArrowRight className="size-4" /></Link></div>
    </header>

    <nav aria-label="说明书目录" className="surface"><div className="surface-content"><p className="mb-3 text-sm font-semibold">快速跳转</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section) => <a key={section.id} href={`#${section.id}`} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm font-medium hover:bg-muted"><span>{section.title}</span><ArrowRight className="size-4 shrink-0 text-primary" /></a>)}</div></div></nav>

    <div className="flex flex-col gap-6">{sections.map((section) => <section key={section.id} id={section.id} className="scroll-mt-20 surface">
      <div className="surface-header"><div><h2 className="surface-title">{section.title}</h2><p className="surface-description">{section.intro}</p></div></div>
      <div className="surface-content grid gap-4">{section.cases.map((item) => <article key={item.when} className="rounded-xl border bg-muted/20 p-4">
        <h3 className="font-semibold">{item.when}</h3>
        <ol className="mt-3 flex flex-col gap-2">{item.how.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span>{step}</span></li>)}</ol>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm leading-6"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{item.note}</span></p>
      </article>)}</div>
    </section>)}</div>

    <aside className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5"><CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" /><div><h2 className="font-bold">安全须知与禁止做法</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">不要删除已履约合同，不要为对上金额直接改原收款，不要用新手机号覆盖签约合同快照，不要向他人透露短信验证码。发现操作错误时，应新增冲正或纠正记录，而不是覆盖历史。</p></div></aside>
  </div>
}
