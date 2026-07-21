import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { assertProductionDatabaseIdentity } from './identity'

const connectionString = process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL
assertProductionDatabaseIdentity({ DATABASE_URL: connectionString })

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
