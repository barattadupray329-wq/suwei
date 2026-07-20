import { getDashboard, getRentals } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  const [summary, rentals, access] = await Promise.all([getDashboard(), getRentals(), getAccessContext('租赁操作')])
  return <Dashboard role={access.role} summary={summary} rentals={rentals} />
}
