'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Avatar } from '@/components/avatar'

/**
 * Slim shell header: wordmark on the left, avatar on the right.
 *
 * The avatar is the entry point to /profile. It lives here rather than as a
 * fifth bottom tab so the four-tab navigation stays intact.
 */
export function AppHeader({
  avatarUrl,
  displayName,
  email,
}: {
  avatarUrl: string | null
  displayName: string | null
  email: string
}) {
  const pathname = usePathname()
  const onProfile = pathname.startsWith('/profile')

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
      {/* Fades the content scrolling underneath rather than hard-cutting it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-base via-base/85 to-transparent"
      />

      <Link
        href="/"
        className="text-[13px] font-bold tracking-[0.22em] text-primary uppercase"
      >
        AJFit
      </Link>

      <Link
        href="/profile"
        aria-label="Your profile"
        aria-current={onProfile ? 'page' : undefined}
        className={`rounded-full transition-all ${
          onProfile
            ? 'ring-2 ring-danger ring-offset-2 ring-offset-base'
            : 'hover:ring-2 hover:ring-hairline hover:ring-offset-2 hover:ring-offset-base'
        }`}
      >
        <Avatar
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
          size={34}
        />
      </Link>
    </header>
  )
}
