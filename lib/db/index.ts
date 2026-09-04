import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

type AnyRecord = Record<PropertyKey, unknown>
type AsyncDbProxy = AnyRecord & ((...args: unknown[]) => Promise<unknown>)

let dbPromise: Promise<AnyRecord> | undefined
const getDb = () => {
  dbPromise ??= getCloudflareContext({ async: true }).then(({ env }) => {
    if (!env.DB) throw new Error('Cloudflare D1 binding DB 未配置')
    return drizzle(env.DB, { schema }) as unknown as AnyRecord
  })
  return dbPromise
}

// 延迟解析 Cloudflare context，避免导入任意数据库调用方时在模块顶层启动 Wrangler。
const createProxy = (path: PropertyKey[] = []): AsyncDbProxy =>
  new Proxy((() => undefined) as unknown as AsyncDbProxy, {
    get(_target, property) {
      return createProxy([...path, property])
    },
    apply(_target, _thisArg, args) {
      return getDb().then((root) => {
        let value: unknown = root
        for (const property of path) value = (value as AnyRecord)[property]
        return (value as (...callArgs: unknown[]) => unknown)(...args)
      })
    },
  })

export const db = createProxy() as unknown as DrizzleD1Database<typeof schema>
