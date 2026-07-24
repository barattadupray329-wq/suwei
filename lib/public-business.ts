import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { businessSettings } from '@/lib/db/schema'

export type PublicBusiness = {
  storeName: string
  lessorName: string
  contactName: string
  phone: string
  address: string
  configured: boolean
}

export async function getPublicBusiness(): Promise<PublicBusiness> {
  const fallback: PublicBusiness = { storeName: '速维电脑租赁', lessorName: '', contactName: '业务负责人', phone: '', address: '', configured: false }
  try {
    const [settings] = await db.select({
      storeName: businessSettings.storeName,
      lessorName: businessSettings.lessorName,
      contactName: businessSettings.contactName,
      phone: businessSettings.phone,
      address: businessSettings.address,
    }).from(businessSettings).orderBy(asc(businessSettings.id)).limit(1)

    const lessorName = settings?.lessorName?.trim() ?? ''
    const phone = settings?.phone?.trim() ?? ''
    return {
      storeName: settings?.storeName?.trim() || fallback.storeName,
      lessorName,
      contactName: settings?.contactName?.trim() || fallback.contactName,
      phone,
      address: settings?.address?.trim() ?? '',
      configured: Boolean(lessorName && phone),
    }
  } catch {
    return fallback
  }
}
