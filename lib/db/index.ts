import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

function createDatabase() {
  const { env } = getCloudflareContext()
  if (!env.DB) throw new Error('Cloudflare D1 绑定 DB 未配置')
  return drizzle(env.DB, { schema })
}

type Database = ReturnType<typeof createDatabase>

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = createDatabase()
    const value = Reflect.get(database, property, database)
    return typeof value === 'function' ? value.bind(database) : value
  },
})
