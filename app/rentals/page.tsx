import { getRentalAssignees, getRentalPage } from '@/app/actions/rentals'
import { RentalRecords } from '@/components/rental-records'

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const value = (key: string) => typeof params[key] === 'string' ? params[key] : ''
  const requestedSort = value('sort')
  const sort = (['newest', 'oldest', 'due', 'amount'].includes(requestedSort) ? requestedSort : 'newest') as 'newest' | 'oldest' | 'due' | 'amount'
  const filters = {
    query: value('query'), status: value('status') || '全部', startDate: value('startDate'), endDate: value('endDate'), assignee: value('assignee'), sort, page: Math.max(1, Number(value('page')) || 1),
  }
  const [result, assignees] = await Promise.all([getRentalPage({ ...filters, pageSize: 20 }), getRentalAssignees()])
  return <RentalRecords {...result} filters={filters} assignees={assignees} />
}
