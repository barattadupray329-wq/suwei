import { describe, expect, it } from 'vitest'
import { depositFinanceSummary, isDepositLedgerEntry, rentFinanceSummary } from '../lib/rental-finance-display'

describe('租赁财务展示核算', () => {
  it('把实收和优惠分开核销，优惠后不再显示待收', () => {
    const summary = rentFinanceSummary({
      totalRent: '1550',
      paidAmount: '1550',
      rentBills: [
        { id: 1, amount: '1100', paidAmount: '1100', dueDate: '2026-06-02' },
        { id: 2, amount: '550', paidAmount: '550', dueDate: '2026-08-01' },
      ],
      ledger: [{ entryType: '收款优惠', amount: '100' }],
    })

    expect(summary.grossRentCents).toBe(165_000)
    expect(summary.discountCents).toBe(10_000)
    expect(summary.netReceivableCents).toBe(155_000)
    expect(summary.cashReceivedCents).toBe(155_000)
    expect(summary.outstandingCents).toBe(0)
    expect(summary.billSettlement.get(2)).toEqual({ cashCents: 45_000, discountCents: 10_000, outstandingCents: 0 })
  })

  it('优惠冲正后恢复待收', () => {
    const summary = rentFinanceSummary({
      totalRent: '1650',
      paidAmount: '1550',
      rentBills: [{ id: 1, amount: '1650', paidAmount: '1550', dueDate: '2026-08-01' }],
      ledger: [
        { entryType: '收款优惠', amount: '100' },
        { entryType: '优惠冲正', amount: '100' },
      ],
    })
    expect(summary.discountCents).toBe(0)
    expect(summary.outstandingCents).toBe(10_000)
  })

  it('展示押金收取、退还和当前余额', () => {
    const summary = depositFinanceSummary({
      contractualDeposit: '1000',
      ledger: [
        { entryType: '押金收取', amount: '1000' },
        { entryType: '押金退还', amount: '-450' },
        { entryType: '押金抵扣赔偿', amount: '-50' },
      ],
    })
    expect(summary).toEqual({ collectedCents: 100_000, returnedOrOffsetCents: 50_000, refundableCents: 50_000 })
    expect(isDepositLedgerEntry('押金退还')).toBe(true)
    expect(isDepositLedgerEntry('收款优惠')).toBe(false)
  })
})
