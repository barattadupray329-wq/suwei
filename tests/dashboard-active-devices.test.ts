import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const actions = readFileSync(new URL('../app/actions/rentals.ts', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../components/dashboard.tsx', import.meta.url), 'utf8')

describe('经营总览在租设备统计', () => {
  test('按设备明细剩余数量汇总并排除结束合同', () => {
    expect(actions).toMatch(/sum\(max\([^)]*quantity[^)]*boughtOutQuantity[^)]*returnedQuantity[^)]*lostQuantity[^)]*, 0\)\)/)
    expect(actions).toMatch(/status} not in \('已关闭', '已完成', '已退回', '已买断', '已丢失'\)/)
    expect(actions).toMatch(/groupBy\(rentalItems\.deviceType\)/)
  })

  test('四类设备均提供零值兜底', () => {
    expect(actions).toContain('const activeDevices = { 台式机: 0, 显示器: 0, 一体机: 0, 笔本: 0 }')
    expect(actions).toContain("if (row.deviceType === '笔记本') activeDevices.笔本 = Number(row.quantity)")
  })

  test('经营总览同时展示四类在租设备及单台明细', () => {
    expect(dashboard).toContain('在租设备')
    expect(dashboard).toContain('Object.entries(summary.activeDevices)')
    expect(dashboard).toContain('active-device-list')
    expect(dashboard).toContain('设备编号')
    expect(dashboard).toContain('起租日期')
    expect(dashboard).toContain('所属承租人')
    expect(actions).toContain('activeDeviceList')
    expect(actions).toContain('expandDeviceCodes(row.deviceCode, row.quantity)')
  })

  test('经营指标卡片均进入对应清单', () => {
    expect(dashboard).toContain('/rentals?orderType=official')
    expect(dashboard).toContain('/rentals?activeOnly=1')
    expect(dashboard).toContain('/rentals?status=逾期')
    expect(dashboard).toContain('/finance?view=receipts')
    expect(dashboard).toContain('/rentals?hasReceivable=1')
    expect(actions).toContain('if (value.activeOnly)')
    expect(actions).toContain('if (value.hasReceivable)')
  })
})
