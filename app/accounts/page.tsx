import { getAccounts } from '@/app/actions/business'
import { AccountManagement } from '@/components/account-management'
import { redirect } from 'next/navigation'
import { getAccessContext } from '@/lib/access'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await getAccessContext()
  if (access.role === 'employee') redirect('/dashboard')
  const params = await searchParams
  const one = (key: string) => typeof params[key] === 'string' ? params[key] as string : undefined
  return <AccountManagement data={await getAccounts({ query: one('query'), level: one('level'), status: one('status'), assignee: one('assignee'), sort: one('sort'), page: Number(one('page') || 1), pageSize: Number(one('pageSize') || 20) })} />
}
