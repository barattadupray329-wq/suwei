import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

const configuredSecret = process.env.BETTER_AUTH_SECRET
if (!configuredSecret && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET 未配置')
}

// 仅供本地开发与 v0 Preview 使用；生产环境仍强制要求 Cloudflare Secret。
const secret = configuredSecret ?? 'suwei-local-preview-secret-do-not-use-in-production'
const baseURL = process.env.BETTER_AUTH_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://tuzhuzu.cn')

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  secret,
  baseURL,
  emailAndPassword: { enabled: true, autoSignIn: true, disableSignUp: true },
  trustedOrigins: [
    'https://tuzhuzu.cn',
    'https://www.tuzhuzu.cn',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})
