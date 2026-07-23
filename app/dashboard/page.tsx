import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboard, getRentalAssignees, getRentals } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [summary, rentals, access, assignees] = await Promise.all([getDashboard(), getRentals(), getAccessContext('租赁操作'), getRentalAssignees()])
  return <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={summary} rentals={rentals} />
}
