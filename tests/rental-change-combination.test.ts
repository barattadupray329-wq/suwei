import { describe, expect, test } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const action = fs.readFileSync(path.join(root, 'app/actions/rental-events.ts'), 'utf8')
const dashboard = fs.readFileSync(path.join(root, 'components/dashboard.tsx'), 'utf8')

describe('配置与租金组合变更', () => {
  test('事件主键独立生成，整组变更不复用设备明细相邻编号', () => {
    expect(action).toContain('const targetItemId = wholeGroup ? item.id : generatedId()')
    expect(action).toContain('const eventId = generatedId()')
    expect(action).not.toContain('const eventId = targetItemId + 1')
  })

  test('配件与租金在同一原子批次中同步落库', () => {
    expect(action).toContain('accessories:value.accessories||null')
    expect(action).toContain('monthlyRent:nextMonthlyRent')
    expect(action).toContain('db.insert(rentalItemPricePeriods)')
    expect(action).toContain('await db.batch(statements')
  })

  test('组合变更确认页显示配件和新旧租金', () => {
    expect(dashboard).toContain('<dt className="text-muted-foreground">配件</dt>')
    expect(dashboard).toContain('selectedItem.accessories || "未填写"')
    expect(dashboard).toContain('value.accessories || "未填写"')
    expect(dashboard).toContain('value.monthlyRent.toLocaleString("zh-CN")')
  })

  test('已知落库失败返回可理解提示并刷新关联页面', () => {
    expect(action).toContain('租金变更数据结构尚未就绪')
    expect(action).toContain('本次变更记录编号冲突，请重新提交')
    expect(action).toContain("revalidatePath('/rentals')")
    expect(action).toContain("revalidatePath('/audit-logs')")
  })
})
