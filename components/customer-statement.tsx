'use client'

import { useState } from 'react'
import { Copy, Printer } from 'lucide-react'
import { toast } from 'sonner'
import type { CustomerStatement, StatementBill } from '@/app/actions/statements'

const money = (n: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

function billLabel(bill: StatementBill) {
  return bill.periodNo ? `第 ${bill.periodNo} 期` : bill.billType
}

function billStatus(bill: StatementBill, today: string) {
  if (bill.dueDate > today) return '未到期'
  if (bill.overdueDays > 0) return `逾期 ${bill.overdueDays} 天`
  return '今日到期'
}

function buildText(data: CustomerStatement, includeUpcoming: boolean) {
  const lines: string[] = []
  const customer = data.customer.company ? `${data.customer.company}（${data.customer.name}）` : data.customer.name
  lines.push(`【${data.lessor.storeName}】租金对账单`)
  lines.push(`客户：${customer}`)
  lines.push(`对账日期：${data.today}`)
  lines.push('')
  for (const contract of data.contracts) {
    const bills = contract.bills.filter((bill) => includeUpcoming || bill.dueDate <= data.today)
    if (!bills.length) continue
    lines.push(`合同 ${contract.contractNo}（${contract.deviceName}）`)
    for (const bill of bills) {
      const paid = bill.paidAmount > 0 ? `，已付 ${money(bill.paidAmount)}` : ''
      lines.push(`· ${billLabel(bill)} ${bill.periodStart} 至 ${bill.periodEnd}，应付 ${money(bill.amount)}${paid}，未付 ${money(bill.outstanding)}（应付日 ${bill.dueDate}，${billStatus(bill, data.today)}）`)
    }
    lines.push('')
  }
  lines.push(`已到期未付合计：${money(data.dueTotal)}（${data.dueCount} 笔）`)
  if (includeUpcoming && data.upcomingCount) lines.push(`未到期待付：${money(data.upcomingTotal)}（${data.upcomingCount} 笔）`)
  if (data.lessor.paymentInfo) lines.push(`收款方式：${data.lessor.paymentInfo}`)
  const contact = [data.lessor.contactName, data.lessor.phone].filter(Boolean).join(' ')
  if (contact) lines.push(`联系人：${contact}`)
  lines.push('如对账目有疑问，请及时与我们联系，谢谢！')
  return lines.join('\n')
}

export function CustomerStatementView({ data }: { data: CustomerStatement }) {
  const [includeUpcoming, setIncludeUpcoming] = useState(false)
  const visibleContracts = data.contracts
    .map((contract) => ({ ...contract, bills: contract.bills.filter((bill) => includeUpcoming || bill.dueDate <= data.today) }))
    .filter((contract) => contract.bills.length > 0)
  const customerNames = data.customer.names.join('、')
  const customerTitle = data.customer.company ? `${data.customer.company}（${customerNames}）` : customerNames
  const otherScope = data.scope === 'customer' ? 'contract' : 'customer'

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText(data, includeUpcoming))
      toast.success('已复制文字版，可直接粘贴到微信发送')
    } catch {
      toast.error('复制失败，请改用打印 / 另存 PDF')
    }
  }

  return (
    <main className="min-h-svh bg-muted p-4 print:bg-card print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="/rentals" className="text-sm text-muted-foreground hover:text-foreground">返回租赁管理</a>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyText} className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">
              <Copy className="size-4" aria-hidden="true" />复制文字版
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Printer className="size-4" aria-hidden="true" />打印 / 另存 PDF
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={includeUpcoming} onChange={(event) => setIncludeUpcoming(event.target.checked)} className="size-4 accent-primary" />
            包含未到期账单
          </label>
          <a href={`/statements/${data.currentRentalId}?scope=${otherScope}`} className="font-medium text-primary hover:underline">
            {data.scope === 'customer' ? '只看当前合同' : '查看该客户全部合同'}
          </a>
          <span className="text-muted-foreground">
            {data.scope === 'customer' ? `当前：该客户（手机号 ${data.customer.phone}）名下全部 ${data.contractCount} 份合同` : '当前：仅本合同'}
          </span>
        </div>
      </div>

      <article className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col gap-6 bg-card px-[14mm] py-[12mm] text-[13px] leading-relaxed text-foreground shadow-sm print:min-h-0 print:max-w-none print:shadow-none">
        <header className="flex flex-col gap-1 border-b pb-4 text-center">
          <p className="text-sm text-muted-foreground">{data.lessor.storeName}</p>
          <h1 className="text-xl font-bold tracking-[.2em]">租金对账单</h1>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2" aria-label="对账信息">
          <p><span className="text-muted-foreground">客户：</span>{customerTitle}</p>
          <p><span className="text-muted-foreground">联系电话：</span>{data.customer.phone}</p>
          <p><span className="text-muted-foreground">对账日期：</span>{data.today}</p>
          <p><span className="text-muted-foreground">生成时间：</span>{data.generatedAt}</p>
          <p className="col-span-2"><span className="text-muted-foreground">对账范围：</span>{data.scope === 'customer' ? `名下全部合同（共 ${data.contractCount} 份，仅列出有未付账单的合同）` : '仅当前合同'}</p>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-label="金额汇总">
          <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <span className="text-muted-foreground">已到期未付合计</span>
            <strong className="text-2xl text-destructive">{money(data.dueTotal)}</strong>
            <span className="text-xs text-muted-foreground">共 {data.dueCount} 笔</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-4">
            <span className="text-muted-foreground">未到期待付</span>
            <strong className="text-2xl">{money(data.upcomingTotal)}</strong>
            <span className="text-xs text-muted-foreground">共 {data.upcomingCount} 笔{includeUpcoming ? '' : '，明细未列出'}</span>
          </div>
        </section>

        {visibleContracts.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 p-6 text-center text-muted-foreground">截至 {data.today}，暂无需要支付的账单。</p>
        ) : (
          visibleContracts.map((contract) => {
            const subtotal = contract.bills.reduce((sum, bill) => sum + bill.outstanding, 0)
            return (
              <section key={contract.id} className="flex flex-col gap-2 break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">合同 {contract.contractNo} · {contract.deviceName}</h2>
                  <span className="text-xs text-muted-foreground">合同租期 {contract.startDate} 至 {contract.endDate}</span>
                </div>
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-y bg-muted/60 text-muted-foreground">
                      <th scope="col" className="px-2 py-2 font-medium">期数</th>
                      <th scope="col" className="px-2 py-2 font-medium">账期</th>
                      <th scope="col" className="px-2 py-2 font-medium">应付日</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">应付</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">已付</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">未付</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.bills.map((bill) => (
                      <tr key={bill.id} className="border-b">
                        <td className="px-2 py-2 font-medium">{billLabel(bill)}</td>
                        <td className="px-2 py-2">{bill.periodStart} 至 {bill.periodEnd}</td>
                        <td className="px-2 py-2">{bill.dueDate}</td>
                        <td className="px-2 py-2 text-right">{money(bill.amount)}</td>
                        <td className="px-2 py-2 text-right">{money(bill.paidAmount)}</td>
                        <td className="px-2 py-2 text-right font-semibold">{money(bill.outstanding)}</td>
                        <td className={`px-2 py-2 text-right ${bill.dueDate <= data.today ? 'text-destructive' : 'text-muted-foreground'}`}>{billStatus(bill, data.today)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-right text-muted-foreground">本合同小计</td>
                      <td className="px-2 py-2 text-right font-semibold">{money(subtotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </section>
            )
          })
        )}

        <footer className="mt-auto flex flex-col gap-2 border-t pt-4 text-[12px]">
          {data.lessor.paymentInfo && <p className="whitespace-pre-line"><span className="text-muted-foreground">收款方式：</span>{data.lessor.paymentInfo}</p>}
          {(data.lessor.contactName || data.lessor.phone) && (
            <p><span className="text-muted-foreground">联系人：</span>{[data.lessor.contactName, data.lessor.phone].filter(Boolean).join(' ')}</p>
          )}
          <p className="text-muted-foreground">账期结束日不含当天。如对账目有疑问，请及时与我们联系。</p>
        </footer>
      </article>
    </main>
  )
}
