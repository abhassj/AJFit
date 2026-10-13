import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // An unrelated lockfile in the home directory makes Next infer the wrong
  // workspace root, so pin it to this project.
  turbopack: {
    root: path.join(__dirname),
  },
  /*
   * At the mobile widths this app is designed for, the dev badge overlaps a
   * real control in every corner: bottom-left/right hit the navigation tabs,
   * top-left the back link, top-right the Program edit button. It also
   * intercepts pointer events, which blocks those controls outright. Next still
   * surfaces compile and runtime errors with the indicator hidden.
   */
  devIndicators: false,
  /*
   * Version skew. With a deployment id, a page from an older deploy that
   * navigates gets a full reload onto the current one instead of mixing old
   * client code with new server code. Vercel sets NEXT_DEPLOYMENT_ID itself
   * when Skew Protection is enabled (Pro and Enterprise plans); that id must
   * win, so this only fills in when it is absent. The commit SHA is unique per
   * deploy and stays within Vercel's 32-character limit when shortened.
   *
   * Server Actions are covered separately: their ids change every build, and
   * the session runner recovers from a stale one by saving its unsaved sets,
   * reloading and replaying them (src/lib/use-write-queue.ts).
   */
  // Keep in step with currentDeploymentId() in src/lib/deployment-id.ts,
  // which /version reports and BuildCheck compares with the page's own id.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID
    ? undefined
    : process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
  images: {
    // AVIF first: the backdrop is a large flat-black photograph, which is
    // exactly the case AVIF compresses far better than WebP.
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
