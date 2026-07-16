import { getAccounts } from '@/app/actions/business'
import { AccountsPage } from '@/components/business-pages'
export default async function Page(){return <AccountsPage data={await getAccounts()}/>}
