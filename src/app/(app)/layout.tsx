import { AppBackground } from '@/components/app-background'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { MotionProvider } from '@/components/motion'
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
  const profile = user ? await getProfile() : null

  return (
    <MotionProvider>
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
