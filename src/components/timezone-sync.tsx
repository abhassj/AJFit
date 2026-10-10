'use client'

import { useEffect, useRef } from 'react'
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
 *
 * The refresh is decided by comparing against `serverZone` — the zone the page
 * on screen was actually rendered with — not against the cookie. Comparing
 * against the cookie lost a race: sign in, land on Home, tap Start before Home
 * has hydrated, and /start is rendered in UTC while Home's copy of this
 * component is writing the cookie. /start's copy then found the cookie already
 * correct, skipped the refresh, and left the UTC weekday's workout on screen.
 */
const MAX_REFRESH_ATTEMPTS = 3
const RETRY_AFTER_MS = 1500

export function TimezoneSync({ serverZone }: { serverZone: string }) {
  const router = useRouter()
  /*
   * Refreshes attempted since the page on screen last matched. Capped, so a
   * zone the server rejects (and keeps answering UTC for) can never turn into
   * a refresh loop; reset once a render arrives in the right zone.
   */
  const attempts = useRef(0)

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

      const readCookie = () => {
        const raw = document.cookie
          .split('; ')
          .find((c) => c.startsWith(`${TIMEZONE_COOKIE}=`))
          ?.slice(TIMEZONE_COOKIE.length + 1)
        return raw ? decodeURIComponent(raw) : undefined
      }

      if (readCookie() !== zone) {
        // A year, so it survives between visits; SameSite=Lax because it is
        // only ever needed on top-level navigations to this origin. Not
        // HttpOnly — it is written here, in the browser, and carries nothing
        // sensitive.
        document.cookie = [
          `${TIMEZONE_COOKIE}=${encodeURIComponent(zone)}`,
          'path=/',
          'max-age=31536000',
          'samesite=lax',
        ].join('; ')
        // Cookies blocked: a refresh would render the same UTC page again.
        if (readCookie() !== zone) return
      }

      if (zone === serverZone) {
        attempts.current = 0
        return
      }
      if (attempts.current >= MAX_REFRESH_ATTEMPTS) return

      // The page currently on screen was rendered against the wrong zone.
      attempts.current++
      router.refresh()

      /*
       * Verify rather than assume. A refresh issued right after hydration can
       * be superseded by the router's own start-up work and silently dropped —
       * the request goes out with the right cookie, but its result never
       * replaces the UTC render on screen. When a refresh does land, this
       * effect re-runs with the new serverZone and cancels the check below.
       */
      retry = window.setTimeout(sync, RETRY_AFTER_MS)
    }

    let retry: number | undefined
    sync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, serverZone])

  return null
}
