const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
const compactTime = buildTime.replace(/[-:TZ.]/g, '').slice(0, 12)
const buildIdentity = process.env.CF_VERSION_METADATA_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local'

export const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || `${compactTime}-${buildIdentity.slice(0, 7)}`
export const BUILD_TIME = buildTime
