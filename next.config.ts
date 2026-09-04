import type { NextConfig } from 'next'

// React 开发模式需要 eval() 来重建调用栈等调试能力，生产环境保持严格策略不放行。
const scriptSrc = process.env.NODE_ENV === 'production'
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
]

const appVersion = process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

const nextConfig: NextConfig = {
  // OpenNext 的 Worker 运行时没有构建命令里的 APP_VERSION；显式内联后，
  // 页面与 /api/sync-state 才能识别部署版本，而不会永远显示 vdev。
  env: { APP_VERSION: appVersion },
  poweredByHeader: false,
  reactCompiler: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig

// v0 项目变量曾以相反字段名写入；仅在开发代理启动前按值格式纠正，
// 避免 Wrangler 把 API Token 当成 account ID 请求 edge-preview。
if (
  process.env.NODE_ENV !== 'production' &&
  process.env.CLOUDFLARE_ACCOUNT_ID?.startsWith('cfat_') &&
  /^[0-9a-fA-F]{32}$/.test(process.env.CLOUDFLARE_API_TOKEN ?? '')
) {
  const accountId = process.env.CLOUDFLARE_API_TOKEN
  process.env.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_ACCOUNT_ID
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId
}

// 仅在配置了 Wrangler API Token 的本地 Cloudflare 开发环境启动远程代理。
// v0 Preview/CI 没有该凭据时，必须跳过代理初始化，避免模块加载阶段直接崩溃。
if (process.env.NODE_ENV !== 'production' && process.env.CLOUDFLARE_API_TOKEN) {
  import('@opennextjs/cloudflare').then((module) => module.initOpenNextCloudflareForDev())
}
