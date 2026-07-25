export const DATA_CHANGE_GATES = [
  '生产备份',
  '备份可读性校验',
  '变更前基线统计',
  '幂等或限定条件变更',
  '变更后数量与金额对账',
  '审计记录',
  '部署后只读复核',
] as const

export const REQUIRED_RECONCILIATION_METRICS = [
  '合同数',
  '设备数',
  '应收总额',
  '已收总额',
  '未收总额',
  '付款分配总额',
  '孤儿记录数',
] as const

export type IntegrityBaseline = Record<(typeof REQUIRED_RECONCILIATION_METRICS)[number], number>

export function compareIntegrityBaselines(before: IntegrityBaseline, after: IntegrityBaseline) {
  return REQUIRED_RECONCILIATION_METRICS.map((metric) => ({
    metric,
    before: before[metric],
    after: after[metric],
    matches: before[metric] === after[metric],
  }))
}

export function assertIntegrityPreserved(before: IntegrityBaseline, after: IntegrityBaseline) {
  const mismatches = compareIntegrityBaselines(before, after).filter((item) => !item.matches)
  if (mismatches.length) {
    throw new Error(`数据完整性校验失败：${mismatches.map((item) => `${item.metric} ${item.before} → ${item.after}`).join('；')}`)
  }
}
