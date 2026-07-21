import type { Metadata } from 'next'
import { getCustomerPortalCustomers } from '@/app/actions/customer-portals'
import { CustomerPortalAdmin } from '@/components/customer-portal-admin'
import { getAccessContext } from '@/lib/access'

export const metadata: Metadata = { title: '客户门户管理 | 速维租赁管理', description: '管理客户专属二维码和查询门户' }
export default async function CustomerPortalsPage() {
  await getAccessContext('合同管理')
  return <CustomerPortalAdmin customers={await getCustomerPortalCustomers()} />
}
