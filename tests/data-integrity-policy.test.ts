import { describe, expect, it } from 'vitest'
import { assertIntegrityPreserved, compareIntegrityBaselines, DATA_CHANGE_GATES, type IntegrityBaseline, REQUIRED_RECONCILIATION_METRICS } from '../lib/data-integrity-policy'

const baseline: IntegrityBaseline = {
  合同数: 120,
  设备数: 196,
  应收总额: 500000,
  已收总额: 320000,
  未收总额: 180000,
  付款分配总额: 320000,
  孤儿记录数: 0,
}

describe('数据完整性升级门禁', () => {
  it('强制包含备份、对账、审计和上线复核', () => {
    expect(DATA_CHANGE_GATES).toEqual([
      '生产备份',
      '备份可读性校验',
      '变更前基线统计',
      '幂等或限定条件变更',
      '变更后数量与金额对账',
      '审计记录',
      '部署后只读复核',
    ])
  })

  it('完整覆盖核心数量、金额与孤儿记录指标', () => {
    expect(REQUIRED_RECONCILIATION_METRICS).toHaveLength(7)
    expect(compareIntegrityBaselines(baseline, baseline).every((item) => item.matches)).toBe(true)
  })

  it('任何关键指标变化都会阻止升级', () => {
    expect(() => assertIntegrityPreserved(baseline, { ...baseline, 已收总额: 319999 })).toThrow('已收总额 320000 → 319999')
  })
})
