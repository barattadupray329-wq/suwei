import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getDefaultAccountRoute } from '@/lib/access'
import { auth } from '@/lib/auth'

export default async function SignIn() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    let destination: string
    try {
      destination = await getDefaultAccountRoute()
    } catch {
      return <AuthForm mode="sign-in" accessError="当前账号不可用或权限配置异常，请联系管理员处理后重新登录" />
    }
    redirect(destination)
  }
  return <AuthForm mode="sign-in" />
}
