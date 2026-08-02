import { ZodError } from 'zod'
import { safeError } from './errors'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string }

const FIELD_LABELS: Record<string, string> = {
  customerName: '联系人姓名',
  customerPhone: '手机号',
  customerCompany: '客户公司',
  customerAddress: '客户地址',
  startDate: '起租日期',
  endDate: '到期日期',
  duration: '租赁时间',
  deposit: '押金',
  items: '租赁设备',
  deviceName: '设备名称',
  deviceConfig: '设备配置',
  quantity: '设备数量',
  monthlyRent: '租金',
}

function zodErrorMessage(error: ZodError) {
  const issue = error.issues[0]
  const field = issue.path.map(String).reverse().map((key) => FIELD_LABELS[key]).find(Boolean)
  const message = issue.message
  if (/Too small|expected string to have/.test(message)) return `${field || '该字段'}填写内容过短，请检查后重新填写`
  if (/Invalid input|Invalid/.test(message)) return `${field || '填写内容'}格式不正确，请检查后重新填写`
  if (/expected number|received NaN/i.test(message)) return `${field || '金额或数量'}必须填写有效数字`
  return field && !message.includes(field) ? `${field}：${message}` : message
}

function errorChain(error: unknown) {
  const messages: string[] = []
  let current = error
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current instanceof Error) messages.push(current.message)
    current = typeof current === 'object' && current && 'cause' in current ? current.cause : undefined
  }
  return messages.join(' ')
}

export async function toActionResult<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action()
    return { ok: true, data }
  } catch (error) {
    console.error(`[${operation}]`, error)
    if (error instanceof ZodError) return { ok: false, message: zodErrorMessage(error) }
    if (errorChain(error).includes('rental assignee must belong to the store')) {
      return { ok: false, message: '维护负责人不属于当前店铺或账号已停用，请重新选择负责人' }
    }
    const safe = safeError(error)
    return { ok: false, message: safe.message }
  }
}
