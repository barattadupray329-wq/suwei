import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDashboard, getRentals } from '@/app/actions/rentals'
import { Dashboard } from '@/components/dashboard'

export default async function Page(){ const session=await auth.api.getSession({headers:await headers()}); if(!session?.user) redirect('/sign-in'); const [summary,rentals]=await Promise.all([getDashboard(),getRentals()]); return <Dashboard userName={session.user.name} summary={summary} rentals={rentals}/> }
