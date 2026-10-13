import { currentDeploymentId } from '@/lib/deployment-id'

/*
 * Which deployment is live, for BuildCheck (src/components/build-check.tsx).
 * Public and tiny: it says nothing but an id already printed in every page.
 * Never cached — by the browser, the CDN or the service worker (which never
 * answers anything outside /_next/static and the listed images).
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { deploymentId: currentDeploymentId() },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  )
}
