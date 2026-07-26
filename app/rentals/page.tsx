import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboard, getRentalAssignees, getRentalById, getRentalPage } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'
import { RentalRecords } from '@/components/rental-records'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

const detailSummary = {
  total: 0, active: 0, draft: 0, overdue: 0, dueSoon: 0, repairPending: 0,
  revenue: '0', monthRevenue: '0', receivable: '0', currentDue: '0', overdue30: '0', overdue60: '0', overdue90: '0',
}

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] : ''
  const rentalId = Number(value('rental'))
  const hasRental = Number.isSafeInteger(rentalId) && rentalId > 0
  const isNew = value('new') === '1'

  if (isNew) {
    const [summary, access, assignees] = await Promise.all([
      getDashboard(),
      getAccessContext('租赁操作'),
      getRentalAssignees(),
    ])
    return <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={summary} rentals={[]} mode="management" initialNew />
  }

  const requestedSort = value('sort')
  const sort = (['newest', 'oldest', 'due', 'amount'].includes(requestedSort) ? requestedSort : 'newest') as 'newest' | 'oldest' | 'due' | 'amount'
  const requestedType = value('orderType')
  const orderType = (['draft', 'test', 'official'].includes(requestedType) ? requestedType : 'all') as 'all' | 'draft' | 'test' | 'official'
  const filters = {
    query: value('query'),
    status: value('status') || '全部',
    startDate: value('startDate'),
    endDate: value('endDate'),
    assignee: value('assignee'),
    orderType,
    lifecycleStatus: 'active' as const,
    sort,
    page: Math.max(1, Number(value('page')) || 1),
  }

  const [result, assignees, linkedRental, access] = await Promise.all([
    getRentalPage({ ...filters, pageSize: 20 }),
    getRentalAssignees(),
    hasRental ? getRentalById(rentalId) : null,
    getAccessContext('租赁操作'),
  ])

  if (hasRental && !linkedRental) redirect('/rentals')

  return <>
    <RentalRecords {...result} filters={filters} assignees={assignees} access={access} />
    {linkedRental && access && <Dashboard role={access.role} permissions={access.permissions} currentActorId={access.actorId} currentActorName={access.actorName} assignees={assignees} summary={detailSummary} rentals={[linkedRental]} mode="management" detailsOnly />}
  </>
}
