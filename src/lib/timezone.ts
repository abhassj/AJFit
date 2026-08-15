/**
 * Resolving "what day is it" for a specific person, rather than for the server.
 *
 * ============================================================================
 * THE BUG THIS EXISTS TO FIX
 * ============================================================================
 * Every date helper in this app reads a Date's *local* fields — getFullYear(),
 * getMonth(), getDate(), getDay(). In a browser those resolve in the viewer's
 * timezone, which is what the original doc comments assumed. But this logic
 * runs on the server, where "local" is the host's timezone: UTC on Vercel.
 *
 * So at 02:22 on 15 August in Kolkata it was still 20:52 on the 14th in UTC,
 * and the whole app insisted it was the 14th. Every user whose offset is not
 * zero got a wrong "today" for some hours of every single day — those ahead of
 * UTC late at night, those behind it early in the morning.
 *
 * ============================================================================
 * THE APPROACH, AND WHY NOT THE OBVIOUS ALTERNATIVES
 * ============================================================================
 * Not "trust the client's clock": that is what the future-rest-day fix removed
 * on purpose. A raw client clock is attacker-controlled in both value and
 * direction, so a spoofed one lets somebody open and backfill days that have
 * not happened.
 *
 * Not "store the timezone on the profile": a stored zone goes stale the moment
 * someone travels, and it fails silently — the app would confidently show the
 * wrong day with no signal that anything was wrong.
 *
 * Instead the browser reports only its IANA *zone name*, and the server keeps
 * supplying the *instant*. The client can influence which calendar day an
 * instant falls in, by at most the ±14h range of real timezones; it cannot
 * claim an arbitrary date, because the clock is still ours. That bound is what
 * makes this safe: the future-day check still holds, since a day genuinely in
 * the future in every timezone on earth stays in the future.
 *
 * ============================================================================
 * HOW zonedNow WORKS
 * ============================================================================
 * It returns a Date whose *local fields* spell out the wall clock in the target
 * zone. That deliberately makes it wrong as an instant — its epoch value is not
 * the real moment — but correct for everything downstream, because every helper
 * in home-types.ts consumes exactly those local fields. One shifted Date at the
 * top therefore fixes the whole dependent tree without touching the arithmetic.
 *
 * The consequence is a rule: NEVER persist a zoned Date, and never call
 * .toISOString() or .getTime() on one. Timestamps written to the database
 * (sessions.start_time, completed_at) must keep using a real `new Date()`.
 * Zoned Dates answer "which calendar day is this person in"; nothing else.
 */

/** Cookie carrying the browser's IANA zone. Read fresh on every request. */
export const TIMEZONE_COOKIE = 'ajfit-tz'

/** Fallback when nothing usable has been reported yet. */
export const FALLBACK_TIME_ZONE = 'UTC'

/**
 * Whether a string is a timezone this runtime actually knows.
 *
 * The value arrives in a cookie, so it is user-controlled and may be absent,
 * stale, garbage, or hostile. Intl throws a RangeError on anything it does not
 * recognise, and an exception thrown while resolving today's date would take
 * down every page at once — so every read goes through here first.
 */
export function isValidTimeZone(value: string): boolean {
  if (!value) return false
  // Cheap shape check before the expensive one; also rejects the header
  // injection shapes a cookie value could otherwise carry.
  if (!/^[A-Za-z0-9+\-_/]{1,64}$/.test(value)) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** A usable IANA zone, falling back to UTC rather than throwing. */
export function resolveTimeZone(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_TIME_ZONE
  const trimmed = raw.trim()
  return isValidTimeZone(trimmed) ? trimmed : FALLBACK_TIME_ZONE
}

/**
 * The current wall clock in `timeZone`, as a Date whose local fields carry it.
 *
 * See the header: the returned Date is a container for calendar fields, not a
 * point in time. Do not persist it.
 */
export function zonedNow(timeZone: string, instant: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    // h23 rather than hour12:false — the latter makes some ICU builds emit
    // hour "24" at midnight, which rolls the Date into the following day and
    // would reintroduce an off-by-one-day bug at exactly the wrong moment.
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const f: Record<string, string> = {}
  for (const { type, value } of parts) f[type] = value

  return new Date(
    Number(f.year),
    Number(f.month) - 1,
    Number(f.day),
    Number(f.hour),
    Number(f.minute),
    Number(f.second),
  )
}

/** Today's calendar date in `timeZone`, as YYYY-MM-DD. */
export function zonedDateKey(
  timeZone: string,
  instant: Date = new Date(),
): string {
  const d = zonedNow(timeZone, instant)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
