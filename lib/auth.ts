import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins/username'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

const authSecret = process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV === 'development' ? crypto.randomUUID() : undefined)
if (!authSecret) throw new Error('生产环境必须配置 BETTER_AUTH_SECRET')

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.V0_RUNTIME_URL),
  emailAndPassword: { enabled: true, autoSignIn: true, disableSignUp: true },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 80, usernameValidator: (value) => /^[a-zA-Z0-9._@+-]+$/.test(value) }),
  ],
  trustedOrigins: [
    'https://tuzhuzu.cn',
    'https://www.tuzhuzu.cn',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  ],
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  ...(process.env.NODE_ENV === 'development' ? { advanced: { defaultCookieAttributes: { sameSite: 'none' as const, secure: true } } } : {}),
})
