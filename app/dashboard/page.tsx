import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboard, getRentalAssignees, getRentalById, getRentals } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function Page({ searchParams }: { searchParams: Promise<{ rental?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const params = await searchParams
  const rentalId = Number(params.rental)
  const [summary, recentRentals, linkedRental, access, assignees] = await Promise.all([getDashboard(), getRentals('', '全部', 12), Number.isSafeInteger(rentalId) && rentalId > 0 ? getRentalById(rentalId) : null, getAccessContext('租赁操作'), getRentalAssignees()])
  const rentalRows = linkedRental && !recentRentals.some((item) => item.id === linkedRental.id) ? [linkedRental, ...recentRentals] : recentRentals
  return <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={summary} rentals={rentalRows} />
}
