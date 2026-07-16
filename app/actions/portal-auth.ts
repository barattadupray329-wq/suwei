'use server'

import { redirect } from 'next/navigation'
import { authenticateCustomerPortal, clearPortalSession } from '@/lib/customer-portal'

export async function loginCustomerPortal(token: string, phone: string, password: string) {
  if (!token || !phone || !password) throw new Error('请完整填写手机号和专属密码')
  await authenticateCustomerPortal(token, phone, password)
}

export async function logoutCustomerPortal(token: string) {
  await clearPortalSession()
  redirect(`/portal/${token}`)
}
