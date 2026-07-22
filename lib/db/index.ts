import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

const { env } = await getCloudflareContext({ async: true })
if (!env.DB) throw new Error('Cloudflare D1 binding DB 未配置')

export const db = drizzle(env.DB, { schema })
