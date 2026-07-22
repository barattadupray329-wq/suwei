import { redirect } from 'next/navigation'

export default function CustomerLoginPage() {
  redirect('/sign-in?method=phone')
}
