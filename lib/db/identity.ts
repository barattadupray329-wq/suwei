const EXPECTED_NEON_PROJECT_ID = 'plain-paper-39576019'
const EXPECTED_DATABASE_HOST = 'ep-purple-hall-auzd0b6w-pooler.c-10.us-east-1.aws.neon.tech'
const EXPECTED_DATABASE_NAME = 'neondb'

export type DatabaseIdentityEnvironment = {
  DATABASE_URL?: string
  NEON_PROJECT_ID?: string
}

export function resolveDatabaseUrl(env: { PRODUCTION_DATABASE_URL?: string; DATABASE_URL?: string } = {
  PRODUCTION_DATABASE_URL: process.env.PRODUCTION_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
}) {
  const candidates = [env.PRODUCTION_DATABASE_URL, env.DATABASE_URL]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      const isPlaceholder = candidate.includes('...') || url.hostname.includes('example.com')
      if (['postgres:', 'postgresql:'].includes(url.protocol) && !isPlaceholder && url.hostname && url.pathname !== '/') return candidate
    } catch {
      // Ignore malformed optional overrides and continue to the managed database URL.
    }
  }
  throw new Error('数据库连接失败：未配置有效的 PostgreSQL DATABASE_URL')
}

export function assertProductionDatabaseIdentity(env: DatabaseIdentityEnvironment = {
  DATABASE_URL: resolveDatabaseUrl(),
  NEON_PROJECT_ID: process.env.PRODUCTION_DATABASE_URL ? undefined : process.env.NEON_PROJECT_ID,
}) {
  if (env.NEON_PROJECT_ID && env.NEON_PROJECT_ID !== EXPECTED_NEON_PROJECT_ID) {
    throw new Error('数据库身份校验失败：NEON_PROJECT_ID 不是获准的唯一正式数据库')
  }

  if (!env.DATABASE_URL) throw new Error('数据库身份校验失败：DATABASE_URL 未配置')

  let databaseUrl: URL
  try {
    databaseUrl = new URL(env.DATABASE_URL)
  } catch {
    throw new Error('数据库身份校验失败：DATABASE_URL 格式无效')
  }

  const databaseName = databaseUrl.pathname.replace(/^\//, '')
  if (databaseUrl.hostname !== EXPECTED_DATABASE_HOST || databaseName !== EXPECTED_DATABASE_NAME) {
    throw new Error('数据库身份校验失败：数据库主机或数据库名不属于 625730448 唯一正式数据库')
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('数据库身份校验失败：只允许 PostgreSQL 连接')
  }

  return {
    projectId: EXPECTED_NEON_PROJECT_ID,
    host: EXPECTED_DATABASE_HOST,
    database: EXPECTED_DATABASE_NAME,
  }
}
