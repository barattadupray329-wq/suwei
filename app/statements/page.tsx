import type { Metadata } from 'next'
import { getCustomerStatementByPhone, listStatementCustomers } from '@/app/actions/statements'
import { CustomerStatementView } from '@/components/customer-statement'
import { StatementCustomerPicker } from '@/components/statement-customer-picker'

export const metadata: Metadata = { title: '客户对账单', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ phone?: string; q?: string; filter?: string }> }) {
  const { phone = '', q = '', filter } = await searchParams
  const [customers, statement] = await Promise.all([listStatementCustomers(), phone ? getCustomerStatementByPhone(phone) : Promise.resolve(null)])

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 print:p-0">
      <div className="flex flex-col gap-1 print:hidden">
        <p className="page-eyebrow">按客户汇总</p>
        <h1 className="page-title">客户对账单</h1>
        <p className="page-description">选择客户，自动汇总其名下全部合同的未付账单，可复制文字版发微信，或打印 / 另存 PDF。</p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <StatementCustomerPicker customers={customers} selectedPhone={phone} query={q} filter={filter === 'all' ? 'all' : 'unpaid'} />
        <div className="min-w-0 flex-1">
          {statement ? (
            <CustomerStatementView data={statement} embedded />
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground print:hidden">
              {phone ? '没有找到这个客户的正式合同。' : '请在左侧选择一个客户，生成其名下全部合同的对账单。'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
