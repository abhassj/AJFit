'use client'

import { ErrorState } from '@/components/error-state'

/**
 * Boundary for every signed-in page: Home, Workouts, Program, Start, Profile
 * and the history detail pages.
 *
 * It sits inside the (app) layout, so the header and bottom navigation stay
 * rendered around it — a failed catalog query leaves the other three tabs one
 * tap away instead of stranding the user on a bare error document.
 *
 * Note that this does NOT catch throws from (app)/layout.tsx itself; an
 * error.tsx never wraps the layout in its own segment. src/app/error.tsx is the
 * boundary for that case.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorState error={error} retry={unstable_retry} />
}
