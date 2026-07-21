import { describe, expect, it } from 'vitest'
import { assertProductionDatabaseIdentity } from '../lib/db/identity'

const validEnvironment = {
  NEON_PROJECT_ID: 'plain-paper-39576019',
  DATABASE_URL: 'postgresql://user:password@ep-purple-hall-auzd0b6w-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
}

describe('正式数据库身份锁', () => {
  it('只允许 625730448 账户下指定的 Neon 数据库', () => {
    expect(assertProductionDatabaseIdentity(validEnvironment)).toEqual({
      projectId: 'plain-paper-39576019',
      host: 'ep-purple-hall-auzd0b6w-pooler.c-10.us-east-1.aws.neon.tech',
      database: 'neondb',
    })
  })

  it('缺少项目标识时通过数据库主机确认身份', () => {
    expect(assertProductionDatabaseIdentity({ DATABASE_URL: validEnvironment.DATABASE_URL })).toEqual({
      projectId: 'plain-paper-39576019',
      host: 'ep-purple-hall-auzd0b6w-pooler.c-10.us-east-1.aws.neon.tech',
      database: 'neondb',
    })
  })

  it('拒绝其他 Neon 项目', () => {
    expect(() => assertProductionDatabaseIdentity({ ...validEnvironment, NEON_PROJECT_ID: 'another-project' })).toThrow('NEON_PROJECT_ID')
  })

  it('拒绝其他数据库主机', () => {
    expect(() => assertProductionDatabaseIdentity({ ...validEnvironment, DATABASE_URL: 'postgresql://user:password@other-host.neon.tech/neondb' })).toThrow('数据库主机')
  })

  it('拒绝其他数据库名和无效连接', () => {
    expect(() => assertProductionDatabaseIdentity({ ...validEnvironment, DATABASE_URL: 'postgresql://user:password@ep-purple-hall-auzd0b6w-pooler.c-10.us-east-1.aws.neon.tech/other' })).toThrow('数据库主机')
    expect(() => assertProductionDatabaseIdentity({ NEON_PROJECT_ID: 'plain-paper-39576019', DATABASE_URL: 'not-a-url' })).toThrow('格式无效')
  })
})
