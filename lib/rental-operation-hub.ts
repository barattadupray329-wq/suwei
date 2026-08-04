export const RENTAL_OPERATION_TYPES = [
  'renewal',
  'return',
  'buyout',
  'loss',
  'exchange',
  'repair',
  'pricing_change',
  'term_change',
  'customer_change',
  'deposit_refund',
] as const

export type RentalOperationType = (typeof RENTAL_OPERATION_TYPES)[number]

export type OperationDefinition = {
  type: RentalOperationType
  label: string
  description: string
  group: '设备处理' | '合同与计费' | '结算处理'
  risk: 'normal' | 'financial' | 'destructive'
  requiresDevice: boolean
  smsScene?: NotificationScene
}

export const NOTIFICATION_SCENES = [
  'rental-created',
  'due-reminder',
  'overdue-reminder',
  'renewal-completed',
  'payment-received',
  'repair-completed',
  'return-completed',
  'buyout-completed',
] as const

export type NotificationScene = (typeof NOTIFICATION_SCENES)[number]
export type NotificationMode = 'automatic' | 'default_on' | 'manual'

export const OPERATION_DEFINITIONS: OperationDefinition[] = [
  { type: 'return', label: '办理退租', description: '退还部分或全部设备，结算租金与扣款', group: '设备处理', risk: 'financial', requiresDevice: true, smsScene: 'return-completed' },
  { type: 'exchange', label: '设备换机', description: '保留合同，替换整台租赁设备', group: '设备处理', risk: 'normal', requiresDevice: true },
  { type: 'loss', label: '登记丢失', description: '减少在租数量并登记赔偿', group: '设备处理', risk: 'destructive', requiresDevice: true },
  { type: 'repair', label: '登记维修', description: '登记故障、维修结果和客户费用', group: '设备处理', risk: 'normal', requiresDevice: true, smsScene: 'repair-completed' },
  { type: 'renewal', label: '办理续租', description: '按期延长租期，可设置分段租金', group: '合同与计费', risk: 'financial', requiresDevice: true, smsScene: 'renewal-completed' },
  { type: 'pricing_change', label: '配置 / 租金变更', description: '调整设备配置或后续租金', group: '合同与计费', risk: 'financial', requiresDevice: true },
  { type: 'term_change', label: '租期调整', description: '缩短租期或调整合同整体日期', group: '合同与计费', risk: 'financial', requiresDevice: false },
  { type: 'customer_change', label: '客户资料变更', description: '更新联系人姓名或电话号码', group: '合同与计费', risk: 'normal', requiresDevice: false },
  { type: 'buyout', label: '办理买断', description: '设备转为客户所有并生成买断应收', group: '结算处理', risk: 'financial', requiresDevice: true, smsScene: 'buyout-completed' },
  { type: 'deposit_refund', label: '退押金', description: '退还押金，或用于抵扣欠租与赔偿', group: '结算处理', risk: 'financial', requiresDevice: false },
]

export function availableOperationQuantity(item: {
  quantity: number
  boughtOutQuantity: number
  returnedQuantity: number
  lostQuantity: number
}) {
  return Math.max(0, item.quantity - item.boughtOutQuantity - item.returnedQuantity - item.lostQuantity)
}

export function operationIdempotencyKey(input: {
  userId: string
  rentalId: number
  type: RentalOperationType
  clientRequestId: string
}) {
  return `${input.userId}:${input.rentalId}:${input.type}:${input.clientRequestId.trim()}`
}

export function operationNumber(type: RentalOperationType, rentalId: number, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const code: Record<RentalOperationType, string> = {
    renewal: 'XR', return: 'TZ', buyout: 'MD', loss: 'DS', exchange: 'HJ', repair: 'WX', pricing_change: 'BG', term_change: 'ZQ', customer_change: 'KH', deposit_refund: 'TY',
  }
  return `${code[type]}-${stamp}-${rentalId}`
}

export function defaultNotificationMode(scene: NotificationScene): NotificationMode {
  if (scene === 'due-reminder' || scene === 'overdue-reminder') return 'automatic'
  if (scene === 'payment-received') return 'manual'
  return 'default_on'
}

export function operationWarnings(input: {
  type: RentalOperationType
  quantity: number
  availableQuantity: number
  amountDelta: number
  sendSms: boolean
  phone?: string
}) {
  const warnings: string[] = []
  if (input.quantity < 1) warnings.push('请选择至少 1 台设备')
  if (input.quantity > input.availableQuantity) warnings.push(`最多只能操作 ${input.availableQuantity} 台`)
  if (input.amountDelta < 0) warnings.push('本次会减少应收金额，请确认减免或退款依据')
  if (input.sendSms && !/^1\d{10}$/.test(input.phone || '')) warnings.push('客户手机号无效，短信不会发送')
  if (input.type === 'loss') warnings.push('丢失登记会永久减少在租数量，提交后请通过冲正流程修正')
  return warnings
}
