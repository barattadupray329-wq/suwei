import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { assertProductionDatabaseIdentity, resolveDatabaseUrl } from './identity'

const connectionString = resolveDatabaseUrl()
if (connectionString === process.env.PRODUCTION_DATABASE_URL) {
  assertProductionDatabaseIdentity({ DATABASE_URL: connectionString })
}

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
