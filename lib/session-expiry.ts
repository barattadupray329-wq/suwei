const AUTH_EXPIRED_PATTERNS = [
  /^未登录$/,
  /登录状态已失效/,
  /请重新登录/,
  /unauthorized/i,
  /not authenticated/i,
  /invalid session/i,
]

export function isAuthExpiredMessage(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : ''
  return AUTH_EXPIRED_PATTERNS.some((pattern) => pattern.test(message.trim()))
}

export function redirectToSignIn() {
  if (typeof window === 'undefined') return
  const returnTo = `${window.location.pathname}${window.location.search}`
  window.location.replace(`/sign-in?expired=1&returnTo=${encodeURIComponent(returnTo)}`)
}

export function handleAuthExpired(value: unknown) {
  if (!isAuthExpiredMessage(value)) return false
  redirectToSignIn()
  return true
}
