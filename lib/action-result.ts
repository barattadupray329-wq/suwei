import { safeError } from './errors'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string }

export async function toActionResult<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action()
    return { ok: true, data }
  } catch (error) {
    console.error(`[${operation}]`, error)
    const safe = safeError(error)
    return { ok: false, message: safe.message }
  }
}
