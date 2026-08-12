import { describe, expect, it } from 'vitest'
import {
  OPERATION_DEFINITIONS,
  OPERATION_ENTRIES,
  OPERATION_GROUPS,
  availableOperationEntries,
  availableOperationQuantity,
  defaultNotificationMode,
  operationIdempotencyKey,
  operationNumber,
  operationWarnings,
} from '../lib/rental-operation-hub'

describe('统一租赁业务中心', () => {
  it('所有高风险业务都只有一个定义入口', () => {
    expect(OPERATION_DEFINITIONS).toHaveLength(10)
    expect(new Set(OPERATION_DEFINITIONS.map((item) => item.type)).size).toBe(OPERATION_DEFINITIONS.length)
    expect(OPERATION_DEFINITIONS.map((item) => item.type)).toEqual(expect.arrayContaining(['return', 'exchange', 'loss', 'repair', 'renewal', 'pricing_change', 'term_change', 'customer_change', 'buyout', 'deposit_refund']))
    expect(OPERATION_DEFINITIONS.find((item) => item.type === 'deposit_refund')).toMatchObject({ requiresDevice: false, group: '结算处理' })
  })

  it('高频业务置顶并拆分配置与租金入口', () => {
    expect(OPERATION_GROUPS).toEqual(['常用业务', '设备有变化', '合同与结算'])
    expect(OPERATION_ENTRIES.slice(0, 4).map((item) => item.key)).toEqual(['renewal', 'return', 'pricing', 'buyout'])
    expect(OPERATION_ENTRIES.filter((item) => item.type === 'pricing_change')).toMatchObject([
      { key: 'pricing', intent: 'pricing', label: '调整后续租金' },
      { key: 'configuration', intent: 'configuration', label: '调整设备配置' },
    ])
  })

  it('不可办理业务保留入口并展示明确原因', () => {
    const entries = availableOperationEntries({ availableItems: 0, refundableDeposit: 0 })
    expect(entries.find((item) => item.key === 'renewal')).toMatchObject({ disabled: true, disabledReason: '当前无可办理设备' })
    expect(entries.find((item) => item.key === 'deposit_refund')).toMatchObject({ disabled: true, disabledReason: '当前无可退押金' })
    expect(entries.find((item) => item.key === 'customer_change')).toMatchObject({ disabled: false })
  })

  it('可操作数量统一扣除所有历史处置', () => {
    expect(availableOperationQuantity({ quantity: 8, boughtOutQuantity: 2, returnedQuantity: 3, lostQuantity: 1 })).toBe(2)
    expect(availableOperationQuantity({ quantity: 2, boughtOutQuantity: 2, returnedQuantity: 1, lostQuantity: 0 })).toBe(0)
  })

  it('业务幂等键包含店铺、合同、类型和客户端请求号', () => {
    expect(operationIdempotencyKey({ userId: 'shop-1', rentalId: 12, type: 'return', clientRequestId: ' request-1 ' })).toBe('shop-1:12:return:request-1')
  })

  it('业务编号可读且按类型区分', () => {
    expect(operationNumber('renewal', 12, new Date('2026-07-27T01:02:03Z'))).toBe('XR-20260727010203-12')
    expect(operationNumber('loss', 12, new Date('2026-07-27T01:02:03Z'))).toMatch(/^DS-/)
  })

  it('到期和逾期默认自动发送，其余业务通知由操作人确认', () => {
    expect(defaultNotificationMode('due-reminder')).toBe('automatic')
    expect(defaultNotificationMode('overdue-reminder')).toBe('automatic')
    expect(defaultNotificationMode('renewal-completed')).toBe('default_on')
    expect(defaultNotificationMode('payment-received')).toBe('manual')
  })

  it('阻止超量操作并提醒无效短信号码', () => {
    expect(operationWarnings({ type: 'return', quantity: 3, availableQuantity: 2, amountDelta: 0, sendSms: true, phone: '123' })).toEqual(expect.arrayContaining(['最多只能操作 2 台', '客户手机号无效，短信不会发送']))
  })

  it('丢失业务始终展示不可逆警告', () => {
    expect(operationWarnings({ type: 'loss', quantity: 1, availableQuantity: 1, amountDelta: 100, sendSms: false })).toContain('丢失登记会永久减少在租数量，提交后请通过冲正流程修正')
  })
})
