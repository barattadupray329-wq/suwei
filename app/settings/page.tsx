import { getSettings } from '@/app/actions/business'
import { SettingsPage } from '@/components/business-pages'
export default async function Page(){return <SettingsPage initial={await getSettings()}/>}
