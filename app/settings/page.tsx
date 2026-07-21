import { getSettings } from '@/app/actions/business'
import { SettingsPage } from '@/components/business-pages'
import { getAccessContext } from '@/lib/access'

export default async function Page() {
  await getAccessContext('系统设置')
  return <SettingsPage initial={await getSettings()} />
}
