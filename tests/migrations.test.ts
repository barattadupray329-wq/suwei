import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDirectory = join(process.cwd(), 'migrations')

async function readMigrations() {
  const names = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort()
  const files = await Promise.all(names.map(async (name) => ({ name, sql: await readFile(join(migrationsDirectory, name), 'utf8') })))
  return { names, files }
}

describe('D1 数据库迁移', () => {
  it('从完整基线开始并保持连续顺序', async () => {
    const { names } = await readMigrations()
    expect(names).toEqual([
      '0000_baseline.sql',
      '0001_role_scoped_access.sql',
      '0002_password_change_challenges.sql',
      '0003_store_assignment_guards.sql',
      '0004_website_packages.sql',
    ])
  })

  it('基线包含所有业务表且可安全重复执行', async () => {
    const { files } = await readMigrations()
    const baseline = files[0].sql
    for (const table of ['user', 'rentals', 'rental_items', 'payment_records', 'backup_snapshots', 'website_packages']) {
      expect(baseline).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``)
    }
    expect(baseline).not.toMatch(/CREATE (?:UNIQUE )?INDEX `(?!IF NOT EXISTS)/)
  })

  it('后续迁移不再重复添加基线字段', async () => {
    const { files } = await readMigrations()
    const incrementalSql = files.slice(1).map((file) => file.sql).join('\n')
    expect(incrementalSql).not.toMatch(/ALTER TABLE\s+\w+\s+ADD COLUMN/i)
  })
})
