import type { Metadata } from 'next'
import { getCustomerStatement } from '@/app/actions/statements'
import { CustomerStatementView } from '@/components/customer-statement'

export const metadata: Metadata = { title: '客户对账单', robots: { index: false, follow: false } }

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scope?: string }> }) {
  const { id } = await params
  const { scope } = await searchParams
  const data = await getCustomerStatement(Number(id), scope === 'contract' ? 'contract' : 'customer')
  return <CustomerStatementView data={data} />
}
