import { describe, expect, it } from 'vitest'
import { settleLegacyReturnAdjustments } from '../lib/legacy-return-adjustments'

const originalBill = {
  id: 1,
  periodStart: '2026-08-05',
  periodEnd: '2026-09-06',
  billType: '逾期续租租金',
  amount: '550.00',
  paidAmount: '0.00',
}

describe('旧版退租调整账单核销', () => {
  it('核销同账期内一一匹配的原账单与负数调整单', () => {
    const result = settleLegacyReturnAdjustments([
      originalBill,
      {
        id: 2,
        periodStart: '2026-08-06',
        periodEnd: '2026-09-06',
        billType: '退租当期租金调整',
        amount: '-550.00',
        paidAmount: '0.00',
      },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 1, amount: '0.00', status: '已调整' })
  })

  it('不核销已收账单', () => {
    const result = settleLegacyReturnAdjustments([
      { ...originalBill, paidAmount: '550.00' },
      { id: 2, periodStart: '2026-08-10', periodEnd: '2026-08-10', billType: '退租当期租金调整', amount: '-550.00', paidAmount: '0.00' },
    ])
    expect(result).toHaveLength(2)
  })

  it('不核销金额或账期无法精确匹配的合法待收', () => {
    const result = settleLegacyReturnAdjustments([
      originalBill,
      { id: 2, periodStart: '2026-07-10', periodEnd: '2026-07-10', billType: '退租当期租金调整', amount: '-330.00', paidAmount: '0.00' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe('550.00')
  })
})
