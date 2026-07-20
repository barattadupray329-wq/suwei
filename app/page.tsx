import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { MarketingHome } from '@/components/marketing-home'
import { getPublicWebsitePackages } from '@/lib/website-packages'

export const metadata: Metadata = {
  title: '电脑租赁月租价格与配置 | 速维电脑租赁',
  description: '龙岩电脑租赁服务，办公电脑、设计电脑、电竞电脑按月灵活租用。本地交付与售后，电话 0597-2685521。',
  alternates: { canonical: 'https://www.tuzhuzu.cn' },
  openGraph: { title: '速维电脑租赁｜电脑按月租更省心', description: '办公、设计、电竞电脑租赁配置与月租参考。', url: 'https://www.tuzhuzu.cn', siteName: '速维电脑租赁', locale: 'zh_CN', type: 'website' },
}

export default async function HomePage() {
  const [packages, qrCode] = await Promise.all([
    getPublicWebsitePackages(),
    QRCode.toDataURL('https://www.tuzhuzu.cn/customer-login', { width: 360, margin: 1, color: { dark: '#173f35', light: '#ffffff' } }),
  ])
  return <MarketingHome packages={packages} qrCode={qrCode} />
}
