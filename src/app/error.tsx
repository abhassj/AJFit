'use client'

import { ErrorState } from '@/components/error-state'

/**
 * Boundary one level above the (app) group.
 *
 * This is what catches a throw from (app)/layout.tsx — the shell itself, which
 * resolves the session and the profile before any page renders. An error.tsx
 * does not wrap the layout in its own segment, so without this file a failed
 * profile lookup in the shell would skip straight past (app)/error.tsx to the
 * unstyled global boundary.
 *
 * It renders without the header or navigation, because the component that
 * draws them is precisely the one that just failed.
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <ErrorState
      error={error}
      retry={unstable_retry}
      title="Could not start the app"
      description="AJFit could not load your account details. Trying again usually clears it; if not, sign in again."
    />
  )
}
