import { BUILD_TIME, BUILD_VERSION } from '@/lib/build-version'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    { version: BUILD_VERSION, builtAt: BUILD_TIME },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } },
  )
}
