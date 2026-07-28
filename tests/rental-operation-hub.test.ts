import { describe, expect, it } from 'vitest'
import {
  OPERATION_DEFINITIONS,
  availableOperationQuantity,
  defaultNotificationMode,
  operationIdempotencyKey,
  operationNumber,
  operationWarnings,
  safeOperationId,
} from '../lib/rental-operation-hub'

describe('统一租赁业务中心', () => {
  it('所有高风险业务都只有一个定义入口', () => {
    expect(new Set(OPERATION_DEFINITIONS.map((item) => item.type)).size).toBe(OPERATION_DEFINITIONS.length)
    expect(OPERATION_DEFINITIONS.map((item) => item.type)).toEqual(expect.arrayContaining(['renewal', 'return', 'buyout', 'loss', 'exchange', 'repair', 'pricing_change', 'contract_change']))
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

  it('业务记录编号保持为安全整数并预留更大随机空间', () => {
    const id = safeOperationId(1_700_000_000_000)
    expect(Number.isSafeInteger(id)).toBe(true)
    expect(Math.floor(id / 4096)).toBe(1_700_000_000_000)
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
