import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actionSource = readFileSync(new URL('../app/actions/rentals.ts', import.meta.url), 'utf8')
const dashboardSource = readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')

describe('设备表单历史补全', () => {
  it('显示器品牌来自当前店铺历史显示器记录', () => {
    expect(actionSource).toContain('deviceName: rentalItems.deviceName')
    expect(actionSource).toContain("item.deviceType === '显示器'")
    expect(actionSource).toContain('monitorBrands')
  })

  it('显示器品牌输入绑定历史建议', () => {
    expect(dashboardSource).toContain('suggestions={item.deviceType === "显示器" ? historySuggestions.monitorBrands : []}')
    expect(dashboardSource).toContain('`rental-monitor-brand-${index}`')
  })

  it('设备附加信息显示为备注且沿用原字段', () => {
    expect(dashboardSource).toContain('label="备注"')
    expect(dashboardSource).toContain('value={item.deviceConfig || ""}')
    expect(dashboardSource).not.toContain('label="其他配置"')
  })
})
