import { redirect } from 'next/navigation'
import { getDashboard, getRentalAssignees, getRentalById, getRentalPage } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { RentalRecords } from '@/components/rental-records'
import { getAccessContext } from '@/lib/access'
import { getCurrentSession } from '@/lib/auth'

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getCurrentSession()
  if (!session?.user) redirect('/sign-in')
  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] : ''
  const rentalId = Number(value('rental'))
  const isNew = value('new') === '1'
  const opensWorkspace = isNew || (Number.isSafeInteger(rentalId) && rentalId > 0)

  if (opensWorkspace) {
    const [summary, linkedRental, access, assignees] = await Promise.all([
      getDashboard(),
      !isNew ? getRentalById(rentalId) : null,
      getAccessContext('租赁操作'),
      getRentalAssignees(),
    ])
    if (!isNew && !linkedRental) redirect('/rentals')
    const returnParams = new URLSearchParams()
    for (const [key, entry] of Object.entries(params)) {
      if (key === 'rental' || key === 'new' || typeof entry !== 'string' || !entry) continue
      returnParams.set(key, entry)
    }
    const returnHref = returnParams.size ? `/rentals?${returnParams}` : '/rentals'
    return <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={summary} rentals={linkedRental ? [linkedRental] : []} mode="management" initialNew={isNew} returnHref={returnHref} />
  }

  const requestedSort = value('sort')
  const sort = (['newest', 'oldest', 'due', 'amount', 'outstanding'].includes(requestedSort) ? requestedSort : 'newest') as 'newest' | 'oldest' | 'due' | 'amount' | 'outstanding'
  const requestedReceivable = value('receivable')
  const receivable = (['outstanding', 'overdue', 'upcoming'].includes(requestedReceivable) ? requestedReceivable : 'all') as 'all' | 'outstanding' | 'overdue' | 'upcoming'
  const requestedType = value('orderType')
  const orderType = (['draft', 'test', 'official'].includes(requestedType) ? requestedType : 'all') as 'all' | 'draft' | 'test' | 'official'
  const filters = {
    query: value('query'), status: value('status') || '全部', startDate: value('startDate'), endDate: value('endDate'), assignee: value('assignee'), orderType, lifecycleStatus: 'active' as const, sort, receivable, page: Math.max(1, Number(value('page')) || 1),
  }
  const [result, assignees] = await Promise.all([getRentalPage({ ...filters, pageSize: 20 }), getRentalAssignees()])
  const filterKey = JSON.stringify(filters)
  return <RentalRecords key={filterKey} {...result} filters={filters} assignees={assignees} />
}
