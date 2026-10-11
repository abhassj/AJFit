'use server'

import { unstable_rethrow } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { getMonthCalendar } from '@/lib/home'
import type { CalendarDay } from '@/lib/home-types'

export type MonthResult =
  | { ok: true; label: string; days: CalendarDay[] }
  | { ok: false; error: string }

/** Backs the calendar's month swipe. */
export async function loadMonth(
  year: number,
  month: number,
): Promise<MonthResult> {
  /*
   * Its own guard, outside the try. This used to rely on a requireUser() deep
   * inside getMonthCalendar, whose redirect() the catch below swallowed — so a
   * signed-out call came back as { ok: false, error: 'NEXT_REDIRECT' } instead
   * of being sent to sign-in. Nothing leaked (anon holds no table grants), but
   * every action now rejects a signed-out caller the same way.
   */
  await requireUser()

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return { ok: false, error: 'Invalid month.' }
  }
  // Normalise so callers can pass month = -1 or 12 and get the neighbour year.
  const d = new Date(year, month, 1)

  try {
    const result = await getMonthCalendar(d.getFullYear(), d.getMonth())
    return { ok: true, ...result }
  } catch (e) {
    unstable_rethrow(e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load that month.',
    }
  }
}
