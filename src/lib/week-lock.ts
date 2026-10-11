import 'server-only'

import { requireUser } from '@/lib/auth'
import { weekBounds } from '@/lib/home-types'
import { getViewerDateKey } from '@/lib/viewer-time'

/** program_day id → the date it was completed on, within one Mon–Sun week. */
export type WeekLocks = Record<string, string>

/**
 * Which program days are already done this week (decision D6).
 *
 * A day locks once it has a COMPLETED session in the Monday–Sunday week of
 * `anchor` (the viewer's today by default, in their own timezone). Skipped
 * days never lock — skipping should not stop you doing the day later — and
 * rest days have no sessions to lock them. Locking only blocks starting the
 * same workout again; editing a logged day through Home stays allowed.
 */
export async function getWeekLocks(anchor?: string): Promise<WeekLocks> {
  const { supabase } = await requireUser()
  const { start, end } = weekBounds(anchor ?? (await getViewerDateKey()))

  const { data, error } = await supabase
    .from('sessions')
    .select('program_day_id, session_date')
    .eq('status', 'completed')
    .gte('session_date', start)
    .lte('session_date', end)
    .not('program_day_id', 'is', null)
    .order('session_date')

  if (error) throw new Error(`Failed to load this week: ${error.message}`)

  const locks: WeekLocks = {}
  for (const row of data ?? []) {
    locks[row.program_day_id as string] ??= row.session_date as string
  }
  return locks
}
