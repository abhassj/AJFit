import { unstable_rethrow } from 'next/navigation'

import { AppBackground } from '@/components/app-background'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { MotionProvider } from '@/components/motion'
import { TimezoneSync } from '@/components/timezone-sync'
import { UnitsProvider } from '@/components/units-provider'
import { getAuthUser } from '@/lib/auth'
import { OnboardingPrompt } from '@/components/onboarding-prompt'
import { getLatestBodyweightKg, getProfile } from '@/lib/profile'
import { DEFAULT_UNITS } from '@/lib/units'
import { getViewerTimeZone } from '@/lib/viewer-time'

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
  const { user } = await getAuthUser()

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
  let onboardingWeightKg: number | null = null
  if (user) {
    try {
      profile = await getProfile()
      // Only accounts that still owe onboarding pay for this lookup.
      if (profile && !profile.onboarded_at) {
        onboardingWeightKg = await getLatestBodyweightKg()
      }
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
      <TimezoneSync serverZone={await getViewerTimeZone()} />
      {/*
       * Existing accounts that predate onboarding get a dismissible prompt
       * (D9). New accounts are sent to /onboarding after confirming their
       * email instead, and the prompt never shows there.
       */}
      {profile && !profile.onboarded_at && (
        <OnboardingPrompt
          initial={{
            displayName: profile.display_name,
            motto: profile.motto,
            weightKg: onboardingWeightKg,
            heightCm: profile.height_cm,
            weightUnit: profile.weight_unit,
            heightUnit: profile.height_unit,
          }}
        />
      )}
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
        <UnitsProvider
          units={
            profile
              ? { weight: profile.weight_unit, height: profile.height_unit }
              : DEFAULT_UNITS
          }
        >
          {children}
        </UnitsProvider>
      </div>
      <BottomNav />
    </MotionProvider>
  )
}
