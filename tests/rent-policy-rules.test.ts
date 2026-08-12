import { describe, expect, it } from 'vitest'
import { priceChangeAdjustment, recalculateBillsAfterReturn, returnRentDecision, returnTiming } from '../lib/overdue-rent'

describe('退租时点与人工租金规则', () => {
  it('区分提前、正常和延迟退租', () => {
    expect(returnTiming('2026-08-09', '2026-08-10')).toBe('early')
    expect(returnTiming('2026-08-10', '2026-08-10')).toBe('on_time')
    expect(returnTiming('2026-08-11', '2026-08-10')).toBe('late')
  })

  it('提前部分退租仅按本次退租台数计算退款', () => {
    const daily = returnRentDecision({ startDate:'2026-08-01',endDate:'2026-08-31',returnDate:'2026-08-10',monthlyRent:'300',quantity:2,mode:'daily' })
    const full = returnRentDecision({ startDate:'2026-08-01',endDate:'2026-08-31',returnDate:'2026-08-10',monthlyRent:'300',quantity:2,mode:'full_month' })
    const waive = returnRentDecision({ startDate:'2026-08-01',endDate:'2026-08-31',returnDate:'2026-08-10',monthlyRent:'300',quantity:2,mode:'waive' })
    expect(daily.adjustmentCents).toBe(40000)
    expect(full.adjustmentCents).toBe(0)
    expect(waive.adjustmentCents).toBe(60000)
  })

  it('延迟退租支持按天、整月和免收', () => {
    const base = { startDate:'2026-07-01',endDate:'2026-08-01',returnDate:'2026-08-16',monthlyRent:'300',quantity:2 }
    expect(returnRentDecision({...base,mode:'late_daily'}).chargeCents).toBe(30000)
    expect(returnRentDecision({...base,mode:'late_monthly'}).chargeCents).toBe(60000)
    expect(returnRentDecision({...base,mode:'late_waive'}).chargeCents).toBe(0)
  })

  it('到期次日退回最后设备时直接核减重叠的未收续租账单', () => {
    const result = recalculateBillsAfterReturn({
      monthlyRent: '120',
      returnedQuantity: 1,
      returnDate: '2026-06-04',
      currentAdjustmentCents: 12000,
      bills: [
        { id: 1, periodStart: '2026-06-03', periodEnd: '2026-07-03', amount: '120', paidAmount: '0', billType: '逾期续租租金' },
      ],
    })
    expect(result).toEqual([
      { id: 1, previousAmountCents: 12000, nextAmountCents: 0, reductionCents: 12000 },
    ])
  })

  it('20 台退 5 台时当期不减租，下一账期只按剩余 15 台', () => {
    const result = recalculateBillsAfterReturn({monthlyRent:'110',returnedQuantity:5,returnDate:'2026-06-18',bills:[
      {id:1,periodStart:'2026-05-28',periodEnd:'2026-06-27',amount:'2200',paidAmount:'0',billType:'租金'},
      {id:2,periodStart:'2026-06-27',periodEnd:'2026-07-27',amount:'2200',paidAmount:'0',billType:'逾期续租租金'},
      {id:3,periodStart:'2026-07-27',periodEnd:'2026-08-27',amount:'2200',paidAmount:'0',billType:'逾期续租租金'},
    ]})
    expect(result).toEqual([
      {id:2,previousAmountCents:220000,nextAmountCents:165000,reductionCents:55000},
      {id:3,previousAmountCents:220000,nextAmountCents:165000,reductionCents:55000},
    ])
  })
})

describe('指定生效日调价', () => {
  it('调高租金只计算生效日至本账期结束', () => {
    expect(priceChangeAdjustment({periodStart:'2026-08-01',periodEnd:'2026-09-01',effectiveDate:'2026-08-16',oldMonthlyRent:'300',newMonthlyRent:'360',quantity:2})).toEqual({newPriceDays:16,adjustmentCents:6400})
  })

  it('调低租金产生负差额且按剩余在租台数计算', () => {
    expect(priceChangeAdjustment({periodStart:'2026-08-01',periodEnd:'2026-09-01',effectiveDate:'2026-08-31',oldMonthlyRent:'360',newMonthlyRent:'300',quantity:1})).toEqual({newPriceDays:1,adjustmentCents:-200})
  })
})
