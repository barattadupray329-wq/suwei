import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = new URL('../lib/db/schema.ts', import.meta.url)
const targetPath = new URL('../lib/db/schema.d1.ts', import.meta.url)

let source = await readFile(sourcePath, 'utf8')

source = source
  .replace(
    "import { boolean, date, integer, jsonb, numeric, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'",
    "import { sql } from 'drizzle-orm'\nimport { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'",
  )
  .replaceAll('pgTable(', 'sqliteTable(')
  .replace(/serial\(([^)]+)\)\.primaryKey\(\)/g, 'integer($1).primaryKey({ autoIncrement: true })')
  .replace(/boolean\(([^)]+)\)/g, "integer($1, { mode: 'boolean' })")
  .replace(/timestamp\(([^)]+)\)/g, "integer($1, { mode: 'timestamp_ms' })")
  .replace(/date\(([^)]+)\)/g, 'text($1)')
  .replace(/numeric\(([^,]+),\s*\{\s*precision:\s*\d+,\s*scale:\s*\d+\s*\}\)/g, 'text($1)')
  .replace(/jsonb\(([^)]+)\)/g, "text($1, { mode: 'json' })")
  .replaceAll('.defaultNow()', ".default(sql`(unixepoch() * 1000)`)")

await writeFile(targetPath, source)
console.log(`Generated ${targetPath.pathname}`)
