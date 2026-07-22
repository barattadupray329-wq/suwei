import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getAccessContext } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function SignIn() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    const access = await getAccessContext()
    redirect(access.role === 'super_admin' ? '/accounts' : '/dashboard')
  }
  return <AuthForm mode="sign-in" />
}
