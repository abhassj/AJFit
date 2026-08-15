import { unstable_rethrow } from 'next/navigation'

import { AppBackground } from '@/components/app-background'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { MotionProvider } from '@/components/motion'
import { TimezoneSync } from '@/components/timezone-sync'
import { getProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'

/**
 * Shell for every signed-in page: ambient backdrop, a slim header carrying the
 * avatar link to /profile, and the four-tab bottom navigation. Auth routes sit
 * outside this group so they render without either.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  /*
   * The profile is decoration here — it supplies the avatar image and the name
   * behind it, and the avatar already falls back to initials without either.
   * Letting a failed profile query throw would take the whole shell down, and
   * because an error.tsx never catches its own segment's layout, the failure
   * would escape past (app)/error.tsx to the bare root boundary: the user loses
   * the bottom navigation and every other tab along with it, over an image.
   *
   * Swallowing it here keeps the shell standing so the page inside can fail on
   * its own terms, inside (app)/error.tsx, with the nav still there to leave by.
   * unstable_rethrow first, so a redirect from an expired session is not caught
   * by this — that one does need to propagate.
   */
  let profile = null
  if (user) {
    try {
      profile = await getProfile()
    } catch (e) {
      unstable_rethrow(e)
      console.error(
        'AJFit: profile lookup failed, rendering shell without it',
        e,
      )
    }
  }

  return (
    <MotionProvider>
      {/*
       * Reports the browser's IANA timezone so the server can resolve "today"
       * for this person rather than for UTC. Mounted in the shell because every
       * date-sensitive screen lives under it, and it must be present before the
       * first date is rendered rather than per-page.
       */}
      <TimezoneSync />
      <AppBackground />
      {/* Bottom padding clears the fixed nav, including the iOS home indicator. */}
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {user && (
          <AppHeader
            avatarUrl={profile?.avatar_url ?? null}
            displayName={profile?.display_name ?? null}
            email={user.email ?? ''}
          />
        )}
        {children}
      </div>
      <BottomNav />
    </MotionProvider>
  )
}
