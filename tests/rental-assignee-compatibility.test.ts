import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('app/actions/rentals.ts', 'utf8')
const schema = readFileSync('lib/db/schema.ts', 'utf8')

describe('合同负责人兼容字段', () => {
  it('schema 映射生产库旧负责人字段', () => {
    expect(schema).toContain("assignedEmployeeId: text('assignedEmployeeId')")
  })

  it('创建合同同步写入新旧负责人字段', () => {
    expect(source).toContain('assignedEmployeeId: assignee.id, assigneeUserId: assignee.id')
  })

  it('变更负责人同步写入新旧负责人字段', () => {
    expect(source).toContain("set({ assignedEmployeeId: assignee.id, assigneeUserId: assignee.id, assigneeName: assignee.name")
  })
})
