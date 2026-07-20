import { getAccounts } from '@/app/actions/business'
import { AccountManagement } from '@/components/account-management'

export default async function Page() {
  return <AccountManagement data={await getAccounts()} />
}
