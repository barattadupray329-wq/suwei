import { redirect } from 'next/navigation'
import { getDashboard, getRentals } from '@/app/actions/rentals'
import { BusinessOverview } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'
import { getCurrentSession } from '@/lib/auth'

export default async function Page() {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in')
  const [summary, rentals, access] = await Promise.all([
    getDashboard(),
    getRentals(),
    getAccessContext(),
  ])
  return <BusinessOverview summary={summary} rentals={rentals} canViewFinance={access.role === 'super_admin' || access.permissions.includes('资金查看')} />
}
