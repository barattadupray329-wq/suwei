import { headers } from 'next/headers'
import { AuthForm } from '@/components/auth-form'
import { getDashboard, getRentals } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return <AuthForm mode="sign-in" />

  const [summary, rentals, access] = await Promise.all([getDashboard(), getRentals(), getAccessContext('租赁操作')])
  return <Dashboard role={access.role} summary={summary} rentals={rentals} />
}
