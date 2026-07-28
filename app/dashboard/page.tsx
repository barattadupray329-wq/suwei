import { redirect } from 'next/navigation'
import { getDashboard } from '@/app/actions/rentals'
import { BusinessOverview } from '@/components/dashboard'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  try {
    await getAccessContext('租赁操作')
    const summary = await getDashboard()
    return <BusinessOverview summary={summary} />
  } catch (error) {
    if (error instanceof Error && error.message === '未登录') redirect('/sign-in')
    throw error
  }
}
