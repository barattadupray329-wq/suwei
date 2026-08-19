import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const action = readFileSync(resolve(process.cwd(), 'app/actions/xiaowei.ts'), 'utf8')
const shell = readFileSync(resolve(process.cwd(), 'components/app-shell.tsx'), 'utf8')
const assistant = readFileSync(resolve(process.cwd(), 'components/xiaowei-assistant.tsx'), 'utf8')

describe('小维经营助手', () => {
  it('每次提问都通过服务端权限上下文隔离门店和客户经理数据', () => {
    expect(action).toContain("getAccessContext('租赁操作')")
    expect(action).toContain('eq(rentals.assigneeUserId, access.actorId)')
    expect(action).toContain('eq(rentals.userId, access.userId)')
  })

  it('覆盖经营查询、到期、待收和风控能力', () => {
    expect(action).toContain('本月租赁概况')
    expect(action).toContain('待收与逾期分析')
    expect(action).toContain('经营风控扫描')
    expect(action).toContain('到期提醒')
    expect(action).toContain('在租${label}排行')
  })

  it('只向有租赁权限的店铺主管和客户经理显示入口', () => {
    expect(shell).toContain("role !== 'super_admin' && can('租赁操作')")
    expect(shell).toContain('<XiaoweiAssistant/>')
    expect(assistant).toContain('精确查询，不猜数字')
    expect(assistant).toContain('小维只分析系统已有数据')
  })
})
