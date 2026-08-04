// 新版本发布后，Cloudflare 上只保留最新构建的 JS 分片，旧标签页再做客户端跳转时会 404。
// 这类报错不是业务异常，统一识别后自动整页刷新，避免用户看到「页面暂时无法加载」。
const STALE_BUILD_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk .+ failed/i,
  /Loading CSS chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Failed to fetch RSC payload/i,
  /is not a valid JavaScript MIME type/i,
  /Unexpected token '<'/i,
]

export const STALE_BUILD_RELOAD_KEY = 'suwei:stale-build-reload'
export const STALE_BUILD_RELOAD_WINDOW_MS = 30_000

export function isStaleBuildError(error: unknown, depth = 0): boolean {
  if (!error || depth > 3) return false
  if (typeof error === 'string') return STALE_BUILD_PATTERNS.some((pattern) => pattern.test(error))
  if (typeof error !== 'object') return false
  const candidate = error as { name?: unknown; message?: unknown; cause?: unknown; reason?: unknown; error?: unknown }
  const text = [candidate.name, candidate.message].filter((part): part is string => typeof part === 'string').join(' ')
  if (text && STALE_BUILD_PATTERNS.some((pattern) => pattern.test(text))) return true
  return isStaleBuildError(candidate.cause, depth + 1) || isStaleBuildError(candidate.reason, depth + 1) || isStaleBuildError(candidate.error, depth + 1)
}

// 30 秒内只允许自动刷新一次，防止真正坏掉的构建把页面拖进无限重载。
export function canAutoReload(now: number, lastReloadAt: string | null, windowMs = STALE_BUILD_RELOAD_WINDOW_MS) {
  const parsed = Number(lastReloadAt)
  if (!lastReloadAt || !Number.isFinite(parsed) || parsed <= 0) return true
  return now - parsed > windowMs
}

export function reloadForStaleBuild() {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  let lastReloadAt: string | null = null
  try {
    lastReloadAt = window.sessionStorage.getItem(STALE_BUILD_RELOAD_KEY)
  } catch {
    lastReloadAt = null
  }
  if (!canAutoReload(now, lastReloadAt)) return false
  try {
    window.sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, String(now))
  } catch {
    // 隐私模式下无法写入 sessionStorage，仍然放行一次刷新。
  }
  window.location.reload()
  return true
}
