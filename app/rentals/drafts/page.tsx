import { getRentalPage } from '@/app/actions/rentals'
import { DraftReview } from '@/components/draft-review'

export const metadata = { title: '草稿审核' }

export default async function DraftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Number(typeof params.page === 'string' ? params.page : '') || 1)
  const result = await getRentalPage({ orderType: 'draft', lifecycleStatus: 'active', sort: 'newest', page, pageSize: 20 })
  return <DraftReview rows={result.rows} total={result.total} page={result.page} pageCount={result.pageCount} />
}
