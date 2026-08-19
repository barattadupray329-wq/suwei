import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const action = readFileSync(resolve(process.cwd(), 'app/actions/xiaowei.ts'), 'utf8')
const shell = readFileSync(resolve(process.cwd(), 'components/app-shell.tsx'), 'utf8')
const assistant = readFileSync(resolve(process.cwd(), 'components/xiaowei-assistant.tsx'), 'utf8')

describe('小维经营助手', () => {
  it('每次提问都通过服务端权限上下文隔离门店和客户经理数据', () => {
    expect(action).toContain("getAccessContext('租赁操作')")
    expect(action).toMatch(/eq\(rentals\.assigneeUserId,\s*access\.actorId\)/)
    expect(action).toMatch(/eq\(rentals\.userId,\s*access\.userId\)/)
  })

  it('覆盖经营查询、到期、待收和风控能力', () => {
    expect(action).toContain('租赁概况')
    expect(action).toContain('月度实际租金收款排行')
    expect(action).toContain('月度退租排行')
    expect(action).toContain('维修业务概况')
    expect(action).toContain('待收与逾期分析')
    expect(action).toContain('经营风控扫描')
    expect(action).toContain('到期提醒')
    expect(action).toContain('在租${hw[2]}排行')
  })

  it('优先区分客户、负责人和设备排行，避免答非所问', () => {
    expect(action.indexOf('if(asksPerson)')).toBeLessThan(action.indexOf("if(/逾期|待收"))
    expect(action).toContain("客户${asksAmount?'合同额':'在租数量'}排行")
    expect(action).toContain("负责人${asksAmount?'合同额':'在租数量'}排行")
    expect(action).toContain('请确认评价口径')
    expect(action).toContain('哪个客户租得最多？')
    expect(action).toContain('电脑配置需要按硬件比较')
  })

  it('只向有租赁权限的店铺主管和客户经理显示入口', () => {
    expect(shell).toContain("role !== 'super_admin' && can('租赁操作')")
    expect(shell).toContain('<XiaoweiAssistant/>')
    expect(assistant).toContain('精确查询，不猜数字')
    expect(assistant).toContain('小维只分析系统已有数据')
  })
})
