export function isTrustedMutationRequest(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false

  const origin = request.headers.get('origin')
  if (!origin) return fetchSite === null || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'

  try {
    const requestUrl = new URL(request.url)
    const originUrl = new URL(origin)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const expectedHost = forwardedHost || requestUrl.host
    const expectedProtocol = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol
    return originUrl.host === expectedHost && originUrl.protocol === expectedProtocol
  } catch {
    return false
  }
}

export function contentLengthExceeds(request: Request, maxBytes: number) {
  const raw = request.headers.get('content-length')
  if (!raw) return false
  const length = Number(raw)
  return !Number.isFinite(length) || length < 0 || length > maxBytes
}
