import { getCloudflareContext } from '@opennextjs/cloudflare'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

type Db = DrizzleD1Database<typeof schema>

let cached: Db | undefined
// 同步解析 Cloudflare context（请求作用域内可用），得到真正的 Drizzle 实例。
// 不使用 { async: true }，因为异步版本会在无凭据的 Preview/CI 里启动 Wrangler 远程代理。
const resolveDb = (): Db => {
  if (cached) return cached
  const { env } = getCloudflareContext()
  if (!env.DB) throw new Error('Cloudflare D1 binding DB 未配置')
  cached = drizzle(env.DB, { schema })
  return cached
}

// 用代理延迟到首次属性访问时才解析 context，避免模块顶层就触发 Cloudflare 初始化；
// 首次 get 之后返回的是真正 Drizzle 实例的方法/属性，因此完整保留同步链式查询 API。
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const real = resolveDb()
    const value = Reflect.get(real as object, property, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
}) as Db
