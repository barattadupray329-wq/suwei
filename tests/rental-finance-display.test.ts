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

  it('按付款分配将两笔优惠分别归属第4期和第5期', () => {
    const summary = rentFinanceSummary({
      totalRent: '5850',
      paidAmount: '5850',
      rentBills: [
        { id: 4, amount: '550', paidAmount: '550', dueDate: '2026-06-27', allocations: [{ paymentRecordId: 40, amount: '550' }] },
        { id: 5, amount: '550', paidAmount: '550', dueDate: '2026-07-27', allocations: [{ paymentRecordId: 50, amount: '550' }] },
      ],
      ledger: [
        { entryType: '收款优惠', amount: '100', paymentRecordId: 40 },
        { entryType: '收款优惠', amount: '100', paymentRecordId: 50 },
      ],
    })

    expect(summary.discountCents).toBe(20_000)
    expect(summary.billSettlement.get(4)).toEqual({ cashCents: 45_000, discountCents: 10_000, outstandingCents: 0 })
    expect(summary.billSettlement.get(5)).toEqual({ cashCents: 45_000, discountCents: 10_000, outstandingCents: 0 })
  })

  it('一笔付款跨账单时只扣减一次优惠', () => {
    const summary = rentFinanceSummary({
      totalRent: '1000',
      paidAmount: '900',
      rentBills: [
        { id: 6, amount: '550', paidAmount: '550', dueDate: '2026-06-27', allocations: [{ paymentRecordId: 60, amount: '550' }] },
        { id: 7, amount: '450', paidAmount: '450', dueDate: '2026-07-27', allocations: [{ paymentRecordId: 60, amount: '450' }] },
      ],
      ledger: [{ entryType: '收款优惠', amount: '100', paymentRecordId: 60 }],
    })

    expect(summary.billSettlement.get(6)).toEqual({ cashCents: 45_000, discountCents: 10_000, outstandingCents: 0 })
    expect(summary.billSettlement.get(7)).toEqual({ cashCents: 45_000, discountCents: 0, outstandingCents: 0 })
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
