import { safeError } from './errors'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string }

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
    if (errorChain(error).includes('rental assignee must belong to the store')) {
      return { ok: false, message: '维护负责人不属于当前店铺或账号已停用，请重新选择负责人' }
    }
    const safe = safeError(error)
    return { ok: false, message: safe.message }
  }
}
