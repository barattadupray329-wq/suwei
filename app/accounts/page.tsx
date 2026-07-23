import { getAccounts } from '@/app/actions/business'
import { AccountManagement } from '@/components/account-management'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  const access = await getAccessContext()
  if (access.role === 'employee') redirect('/dashboard')
  return <AccountManagement data={await getAccounts()} />
}
