'use server'

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
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return { ok: false, error: 'Invalid month.' }
  }
  // Normalise so callers can pass month = -1 or 12 and get the neighbour year.
  const d = new Date(year, month, 1)

  try {
    const result = await getMonthCalendar(d.getFullYear(), d.getMonth())
    return { ok: true, ...result }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not load that month.',
    }
  }
}
