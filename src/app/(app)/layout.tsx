import { AppBackground } from '@/components/app-background'
import { BottomNav } from '@/components/bottom-nav'

/**
 * Shell for every signed-in page: ambient backdrop plus the four-tab bottom
 * navigation. Auth routes sit outside this group so they render without nav.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBackground />
      {/* Bottom padding clears the fixed nav, including the iOS home indicator. */}
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
