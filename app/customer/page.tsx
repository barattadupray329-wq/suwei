import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalDashboard } from '@/components/customer-portal'
import { getCustomerActiveRentals } from '@/lib/customer-phone-auth'

export const metadata: Metadata = {
  title: '我的租赁服务 | 速维租赁',
  description: '查看本人设备、合同期限、费用情况与服务记录',
  robots: { index: false, follow: false },
}

export default async function CustomerPage() {
  const data = await getCustomerActiveRentals()
  if (!data) redirect('/customer-login')
  return <PortalDashboard data={data} phoneSession />
}
