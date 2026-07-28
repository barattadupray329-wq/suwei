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
    expect(actions).toContain('const activeDevices = { 台式机: 0, 显示器: 0, 一体机: 0, 笔记本: 0 }')
    expect(actions).toContain('activeDevices[row.deviceType as keyof typeof activeDevices] = Number(row.quantity)')
  })

  test('经营总览同时展示四类在租设备并可进入对应记录', () => {
    expect(dashboard).toContain('在租设备')
    expect(dashboard).toContain('Object.entries(summary.activeDevices)')
    expect(dashboard).toContain('/rentals?query=${encodeURIComponent(deviceType)}')
    expect(dashboard).toContain('查看在租记录')
  })
})
