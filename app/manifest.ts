import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: '速维电脑租赁管理系统',
    short_name: '速维租赁',
    description: '电脑租赁合同、设备、账务与客户业务管理系统',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7f6',
    theme_color: '#0b6b4b',
    orientation: 'any',
    categories: ['business', 'finance', 'productivity'],
    lang: 'zh-CN',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
