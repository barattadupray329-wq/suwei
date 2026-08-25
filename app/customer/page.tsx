import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCustomerActiveRentals } from '@/lib/customer-phone-auth'
import { CustomerDashboardView } from '@/components/customer-dashboard-view'

export const metadata: Metadata = { title: '我的在租信息 | 速维租赁', robots: { index: false, follow: false } }

export default async function CustomerPage() {
  const data = await getCustomerActiveRentals()
  if (!data) redirect('/customer-login')
  return <CustomerDashboardView data={data} mode="live" />
}
