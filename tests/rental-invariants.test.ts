import { describe, expect, it } from 'vitest'
import { assertDateOrder, dateOnly, inclusiveDays, rentalEndDate } from '../lib/rental-calculations'
import { assertQuantityInvariant, availableQuantity, rentalLifecycleStatus } from '../lib/rental-lifecycle'
import { activePositivePayments, assertFinancialReconciliation, billsOutstandingCents, contractAvailableQuantity, nonDepositPaymentCents, normalizedBillStatus, paymentStatusFromCents, reversedBillPaidCents, reversedContractAmounts } from '../lib/rental-reconciliation'

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

  it('合同已收以全部非押金流水为准并计入冲正', () => {
    expect(nonDepositPaymentCents([
      { amount: '2800.00', feeType: '原合同租金' },
      { amount: '1200.00', feeType: '续租费' },
      { amount: '200.00', feeType: '续租费' },
      { amount: '200.00', feeType: '续租费' },
      { amount: '-200.00', feeType: '续租费' },
      { amount: '500.00', feeType: '押金' },
    ])).toBe(420000)
  })

  it('仅返回未冲正的正数收款且不依赖备注文本', () => {
    const payments = [
      { id: 1, amount: '4000.00', feeType: '押金' },
      { id: 2, amount: '660.00', feeType: '续租费' },
      { id: 3, amount: '-4000.00', feeType: '押金' },
    ]
    expect(activePositivePayments(payments, [{ paymentRecordId: 1 }]).map((payment) => payment.id)).toEqual([2])
  })

  it('冲正严格回退账单已收，禁止静默截断异常余额', () => {
    expect(reversedBillPaidCents('100.00', [{ amount: '40.00' }, { amount: '10.00' }])).toBe(5000)
    expect(() => reversedBillPaidCents('40.00', [{ amount: '50.00' }])).toThrow('账单已收小于待冲正分配')
    expect(() => reversedBillPaidCents('40.00', [])).toThrow('缺少有效的账单分配')
  })

  it('冲正租金恢复优惠并回退实收，押金不影响合同租金', () => {
    expect(reversedContractAmounts({ total: '900.00', paid: '400.00', payments: [{ amount: '400.00', feeType: '原合同租金' }], discountAmount: '100.00' })).toEqual({ totalCents: 100000, paidCents: 0, paymentStatus: '待收款' })
    expect(reversedContractAmounts({ total: '900.00', paid: '400.00', payments: [{ amount: '500.00', feeType: '押金' }] })).toEqual({ totalCents: 90000, paidCents: 40000, paymentStatus: '部分收款' })
    expect(() => reversedContractAmounts({ total: '900.00', paid: '300.00', payments: [{ amount: '400.00', feeType: '续租费' }] })).toThrow('合同已收小于待冲正收款')
  })

  it('账单状态保留调整终态并正确推导普通账单', () => {
    expect(normalizedBillStatus('-60.00', '0', '已调整')).toBe('已调整')
    expect(normalizedBillStatus('0', '0', '已减免')).toBe('已减免')
    expect(normalizedBillStatus('100.00', '0')).toBe('待收款')
    expect(normalizedBillStatus('100.00', '25.00')).toBe('部分收款')
    expect(normalizedBillStatus('100.00', '100.00')).toBe('已结清')
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
