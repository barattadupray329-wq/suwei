import type { Metadata } from 'next'
import { getCustomerPortalCustomers } from '@/app/actions/customer-portals'
import { CustomerPortalAdmin } from '@/components/customer-portal-admin'
import { getAccessContext } from '@/lib/access'

export const metadata: Metadata = { title: '客户查询与访问管理 | 速维租赁管理', description: '管理客户短信查询权限、登录状态与安全会话' }
export default async function CustomerPortalsPage() {
  await getAccessContext('合同管理')
  return <CustomerPortalAdmin customers={await getCustomerPortalCustomers()} />
}
