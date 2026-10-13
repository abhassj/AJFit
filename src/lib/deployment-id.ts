/**
 * The id of the deployment this server is running, or null outside Vercel.
 *
 * Must match `deploymentId` in next.config.ts — the value Next stamps on every
 * page as <html data-dpl-id>. Vercel's own id (NEXT_DEPLOYMENT_ID, set when
 * Skew Protection is on) wins; otherwise the short commit SHA.
 */
export function currentDeploymentId(): string | null {
  return (
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    null
  )
}
