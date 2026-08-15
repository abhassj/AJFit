import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'

import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/program-types'
import { TIMEZONE_COOKIE, resolveTimeZone, zonedNow } from '@/lib/timezone'

/**
 * The single server-side source of "now" for the signed-in viewer.
 *
 * Everything date-sensitive — the weekly bar, the month grid, the Start default
 * day, the backfill guard, bodyweight's log_date — resolves through here, so
 * there is exactly one place where a timezone can be got wrong. That is the
 * point: the original bug was not four screen bugs, it was one utility, and
 * four screens faithfully reproducing it.
 *
 * `cache()` memoises per request. Without it two calls a few milliseconds apart
 * could straddle midnight and disagree, which would show a calendar whose
 * "today" highlight and whose tappability came from different days.
 *
 * The zone is read from a cookie on every request rather than stored on the
 * profile, so someone who travels is right on their next page load instead of
 * being quietly wrong until they notice and fix a setting.
 */

/** The viewer's IANA zone, validated, defaulting to UTC. */
export const getViewerTimeZone = cache(async (): Promise<string> => {
  const store = await cookies()
  return resolveTimeZone(store.get(TIMEZONE_COOKIE)?.value)
})

/**
 * The viewer's current wall clock, as a Date carrying their local fields.
 *
 * Not a real instant — see src/lib/timezone.ts. Never persist it and never call
 * toISOString() on it; database timestamps must come from a plain `new Date()`.
 */
export const getViewerNow = cache(async (): Promise<Date> => {
  return zonedNow(await getViewerTimeZone())
})

/** The viewer's today, as YYYY-MM-DD. */
export async function getViewerDateKey(): Promise<string> {
  const now = await getViewerNow()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The viewer's weekday today, Monday-first to match program.day_of_week. */
export async function getViewerDayOfWeek(): Promise<DayOfWeek> {
  const now = await getViewerNow()
  return DAYS_OF_WEEK[(now.getDay() + 6) % 7]
}
