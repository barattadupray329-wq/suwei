import { getAccounts } from '@/app/actions/business'
import { AccountManagement } from '@/components/account-management'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  await getAccessContext('账号管理')
  return <AccountManagement data={await getAccounts()} />
}
