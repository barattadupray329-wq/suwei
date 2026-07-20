import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CustomerPhoneLogin } from '@/components/customer-phone-login'
import { getCustomerActiveRentals } from '@/lib/customer-phone-auth'

export const metadata: Metadata = { title: '客户在租信息查询 | 速维租赁', description: '通过手机验证码安全查看本人当前在租设备', robots: { index: false, follow: false } }

export default async function CustomerLoginPage() {
  if (await getCustomerActiveRentals()) redirect('/customer')
  return <CustomerPhoneLogin />
}
