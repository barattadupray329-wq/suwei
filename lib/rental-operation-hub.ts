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

export type OperationIntent = 'configuration' | 'pricing'
export type OperationGroup = '常用业务' | '设备有变化' | '合同与结算'

export type OperationDefinition = {
  type: RentalOperationType
  label: string
  description: string
  group: '设备处理' | '合同与计费' | '结算处理'
  risk: 'normal' | 'financial' | 'destructive'
  requiresDevice: boolean
  smsScene?: NotificationScene
}

export type OperationEntry = {
  key: string
  type: RentalOperationType
  intent?: OperationIntent
  label: string
  description: string
  group: OperationGroup
  risk: OperationDefinition['risk']
  requiresDevice: boolean
}

export type OperationAvailabilityContext = {
  availableItems: number
  refundableDeposit: number
}

export type AvailableOperationEntry = OperationEntry & {
  disabled: boolean
  disabledReason?: string
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

export const OPERATION_GROUPS: OperationGroup[] = ['常用业务', '设备有变化', '合同与结算']

export const OPERATION_ENTRIES: OperationEntry[] = [
  { key: 'renewal', type: 'renewal', label: '办理续租', description: '延长到期日，并生成后续账单', group: '常用业务', risk: 'financial', requiresDevice: true },
  { key: 'return', type: 'return', label: '办理退租', description: '退还部分或全部设备，并结算费用', group: '常用业务', risk: 'financial', requiresDevice: true },
  { key: 'pricing', type: 'pricing_change', intent: 'pricing', label: '调整后续租金', description: '从下一完整账期开始使用新租金', group: '常用业务', risk: 'financial', requiresDevice: true },
  { key: 'buyout', type: 'buyout', label: '办理买断', description: '设备转为客户所有，并生成买断应收', group: '常用业务', risk: 'financial', requiresDevice: true },
  { key: 'exchange', type: 'exchange', label: '设备换机', description: '保留合同，替换整台租赁设备', group: '设备有变化', risk: 'normal', requiresDevice: true },
  { key: 'configuration', type: 'pricing_change', intent: 'configuration', label: '调整设备配置', description: '修改 CPU、内存、硬盘等设备配置', group: '设备有变化', risk: 'normal', requiresDevice: true },
  { key: 'repair', type: 'repair', label: '登记维修', description: '登记故障、维修结果和客户费用', group: '设备有变化', risk: 'normal', requiresDevice: true },
  { key: 'loss', type: 'loss', label: '登记丢失', description: '减少在租数量，并登记赔偿', group: '设备有变化', risk: 'destructive', requiresDevice: true },
  { key: 'term_change', type: 'term_change', label: '租期调整', description: '缩短租期或调整合同整体日期', group: '合同与结算', risk: 'financial', requiresDevice: false },
  { key: 'customer_change', type: 'customer_change', label: '客户资料变更', description: '更新联系人姓名或电话号码', group: '合同与结算', risk: 'normal', requiresDevice: false },
  { key: 'deposit_refund', type: 'deposit_refund', label: '退押金', description: '退还押金，或用于抵扣欠租与赔偿', group: '合同与结算', risk: 'financial', requiresDevice: false },
]

export function availableOperationEntries(context: OperationAvailabilityContext): AvailableOperationEntry[] {
  return OPERATION_ENTRIES.map((entry) => {
    if (entry.requiresDevice && context.availableItems === 0) {
      return { ...entry, disabled: true, disabledReason: '当前无可办理设备' }
    }
    if (entry.type === 'deposit_refund' && context.refundableDeposit <= 0) {
      return { ...entry, disabled: true, disabledReason: '当前无可退押金' }
    }
    return { ...entry, disabled: false }
  })
}

export function recommendedOperation(input: { endDate: string; availableItems: number; today?: string }) {
  if (input.availableItems === 0) return null
  const todayValue = input.today ?? new Date().toISOString().slice(0, 10)
  const daysUntilDue = Math.ceil((Date.parse(`${input.endDate}T00:00:00Z`) - Date.parse(`${todayValue}T00:00:00Z`)) / 86_400_000)
  if (daysUntilDue <= 30) return { key: 'renewal', reason: daysUntilDue < 0 ? '合同已到期，建议先确认是否续租' : `距离到期还有 ${daysUntilDue} 天，可提前办理续租` }
  return null
}

export function operationPrinciple(entry: Pick<OperationEntry, 'type' | 'intent' | 'risk'>) {
  if (entry.type === 'pricing_change' && entry.intent === 'pricing') return '新租金只能从下一完整账期生效，当前账期仍按原租金计算。'
  if (entry.type === 'pricing_change') return '设备配置与租金分别核对；若租金不变，请保持原金额。'
  if (entry.risk === 'destructive') return '此业务会改变在租数量，提交前请再次核对设备与赔偿金额。'
  return '原合同、历史账目和业务记录都会保留；提交前还会再次核对。'
}

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
