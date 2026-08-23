import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboard } from '@/app/actions/rentals'
import { BusinessOverview } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const [summary, access] = await Promise.all([
    getDashboard(),
    getAccessContext(),
  ])
  return <BusinessOverview summary={summary} canViewFinance={access.role === 'super_admin' || access.permissions.includes('资金查看')} />
}
