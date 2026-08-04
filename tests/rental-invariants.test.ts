import { describe, expect, it } from 'vitest'
import { assertDateOrder, dateOnly, inclusiveDays, rentalEndDate } from '../lib/rental-calculations'
import { assertQuantityInvariant, availableQuantity, rentalLifecycleStatus } from '../lib/rental-lifecycle'
import { assertFinancialReconciliation, billsOutstandingCents, contractAvailableQuantity, paymentStatusFromCents, rentalFinancialSnapshot } from '../lib/rental-reconciliation'

describe('全流程业务不变量', () => {
  it('拒绝不存在的日期并正确处理闰年', () => {
    expect(() => dateOnly('2026-02-29')).toThrow('日期不存在')
    expect(dateOnly('2028-02-29').toISOString().slice(0, 10)).toBe('2028-02-29')
    expect(inclusiveDays('2028-02-28', '2028-03-01')).toBe(3)
    expect(() => assertDateOrder('2026-03-02', '2026-03-01')).toThrow()
  })

  it('月底月租按目标月末对齐且结束日为下一周期前一天', () => {
    expect(rentalEndDate('2026-01-31', 1, 'monthly')).toBe('2026-02-27')
    expect(rentalEndDate('2028-01-31', 1, 'monthly')).toBe('2028-02-28')
  })

  it('拒绝处置数量超过原始数量', () => {
    expect(() => assertQuantityInvariant({ quantity: 2, returnedQuantity: 1, boughtOutQuantity: 1, lostQuantity: 1 })).toThrow()
    expect(availableQuantity({ quantity: 4, returnedQuantity: 1, boughtOutQuantity: 1, lostQuantity: 1 })).toBe(1)
  })

  it('合同可用数量和生命周期来自所有设备明细', () => {
    const items = [
      { quantity: 3, returnedQuantity: 1, boughtOutQuantity: 0, lostQuantity: 0 },
      { quantity: 2, returnedQuantity: 0, boughtOutQuantity: 1, lostQuantity: 1 },
    ]
    expect(contractAvailableQuantity(items)).toBe(2)
    expect(rentalLifecycleStatus(items)).toBe('部分退租')
  })

  it('账单余额与支付状态统一使用整数分', () => {
    const bills = [{ amount: '100.10', paidAmount: '20.05' }, { amount: '-10.00', paidAmount: '0.00' }]
    expect(billsOutstandingCents(bills)).toBe(8005)
    expect(paymentStatusFromCents(10010, 2005)).toBe('部分收款')
  })

  it('对账拒绝合同、账单和收款不一致', () => {
    expect(assertFinancialReconciliation({ contractTotal: '100.10', contractPaid: '20.05', bills: [{ amount: '100.10', paidAmount: '20.05' }], payments: [{ amount: '20.05', feeType: '租金' }], allocations: [{ amount: '20.05' }] })).toBe(true)
    expect(() => assertFinancialReconciliation({ contractTotal: '100.10', contractPaid: '20.05', bills: [{ amount: '99.10', paidAmount: '20.05' }], payments: [{ amount: '20.05' }] })).toThrow('合同应收与账单应收不一致')
  })

  it('统一财务快照严格区分现金、优惠、核销和押金', () => {
    const snapshot = rentalFinancialSnapshot({
      bills: [
        { id: 1, amount: '550.00', paidAmount: '550.00', billType: '租金' },
        { id: 2, amount: '300.00', paidAmount: '300.00', billType: '押金' },
      ],
      payments: [
        { id: 10, amount: '450.00', feeType: '原合同租金' },
        { id: 20, amount: '300.00', feeType: '押金' },
      ],
      allocations: [{ paymentRecordId: 10, amount: '550.00' }],
      discounts: [{ paymentRecordId: 10, amount: '100.00' }],
    })
    expect(snapshot).toEqual({
      rentReceivableCents: 55_000,
      cashReceivedCents: 45_000,
      effectiveDiscountCents: 10_000,
      allocatedSettlementCents: 55_000,
      outstandingCents: 0,
      depositReceivableCents: 30_000,
      depositReceivedCents: 30_000,
      unallocatedCashCents: 0,
      reconciliationDifferenceCents: 0,
    })
  })

  it('发现优惠被重复计入现金或核销不完整时拒绝对账', () => {
    const input = {
      contractTotal: '550.00',
      contractPaid: '450.00',
      bills: [{ amount: '550.00', paidAmount: '550.00', billType: '租金' }],
      payments: [{ id: 10, amount: '450.00', feeType: '原合同租金' }],
      allocations: [{ paymentRecordId: 10, amount: '550.00' }],
      discounts: [{ paymentRecordId: 10, amount: '100.00' }],
    }
    expect(assertFinancialReconciliation(input)).toBe(true)
    expect(() => assertFinancialReconciliation({ ...input, allocations: [{ paymentRecordId: 10, amount: '450.00' }] })).toThrow('账单核销必须等于真实现金与有效优惠之和')
  })

  it('未分配旧收款显式进入未分配金额', () => {
    const snapshot = rentalFinancialSnapshot({
      bills: [{ amount: '500.00', paidAmount: '0.00', billType: '租金' }],
      payments: [{ id: 1, amount: '200.00', feeType: '租金' }],
      allocations: [],
    })
    expect(snapshot.unallocatedCashCents).toBe(20_000)
    expect(snapshot.outstandingCents).toBe(50_000)
  })

  it('押金与租金独立核算，不计入合同租金应收和已收', () => {
    expect(assertFinancialReconciliation({
      contractTotal: '100.00',
      contractPaid: '40.00',
      bills: [
        { amount: '100.00', paidAmount: '40.00', billType: '租金' },
        { amount: '500.00', paidAmount: '500.00', billType: '押金' },
      ],
      payments: [
        { amount: '40.00', feeType: '原合同租金' },
        { amount: '500.00', feeType: '押金' },
      ],
    })).toBe(true)
  })
})
