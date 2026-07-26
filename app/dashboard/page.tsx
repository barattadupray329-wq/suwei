import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboard } from '@/app/actions/rentals'
import { BusinessOverview } from '@/components/dashboard'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const summary = await getDashboard()
  return <BusinessOverview summary={summary} />
}
