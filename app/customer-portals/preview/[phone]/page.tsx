import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PortalDashboard } from '@/components/customer-portal'
import { getAccessContext } from '@/lib/access'
import { getCustomerPortalPreviewData } from '@/lib/customer-portal'

export const metadata: Metadata = {
  title: '客户视角预览 | 速维租赁管理',
  description: '管理员只读预览客户租赁服务页面',
  robots: { index: false, follow: false },
}

export default async function CustomerPortalPreviewPage({ params }: { params: Promise<{ phone: string }> }) {
  const { userId } = await getAccessContext('系统设置')
  const { phone } = await params
  const data = await getCustomerPortalPreviewData(userId, decodeURIComponent(phone))
  if (!data) notFound()
  return <PortalDashboard data={data} preview />
}
