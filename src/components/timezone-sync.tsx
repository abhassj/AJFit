'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { TIMEZONE_COOKIE } from '@/lib/timezone'

/**
 * Reports the browser's IANA timezone to the server, via a cookie.
 *
 * Renders nothing. A cookie rather than a header because a document navigation
 * carries no JavaScript-set headers — the server has to already have the value
 * when it renders, and a cookie is the only thing that travels that way.
 *
 * Only the zone *name* crosses the boundary, never a clock reading. The server
 * still decides what time it is; this only says which calendar to read it
 * against. See src/lib/timezone.ts for why that distinction is what keeps the
 * future-day check honest.
 *
 * Re-checked on mount and whenever the tab is brought back to the foreground,
 * so someone who lands in another country is correct on their next interaction
 * rather than until they clear their cookies. Nothing is written unless the
 * zone actually changed, so the refresh below cannot loop.
 *
 * First visit costs one extra render: the server has no cookie yet, falls back
 * to UTC, and this refreshes once the real zone is known. Self-correcting, and
 * only ever on the first load or after travel.
 */
export function TimezoneSync() {
  const router = useRouter()

  useEffect(() => {
    const sync = () => {
      let zone: string | undefined
      try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        // Ancient or locked-down browser: leave the server on its UTC default
        // rather than writing something it will only reject.
        return
      }
      if (!zone) return

      const current = document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${TIMEZONE_COOKIE}=`))
        ?.slice(TIMEZONE_COOKIE.length + 1)

      if (current && decodeURIComponent(current) === zone) return

      // A year, so it survives between visits; SameSite=Lax because it is only
      // ever needed on top-level navigations to this origin. Not HttpOnly — it
      // is written here, in the browser, and carries nothing sensitive.
      document.cookie = [
        `${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}`,
        'path=/',
        'max-age=31536000',
        'samesite=lax',
      ].join('; ')

      // The page currently on screen was rendered against the wrong zone.
      router.refresh()
    }

    sync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

  return null
}
