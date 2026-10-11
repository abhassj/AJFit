import 'server-only'

import { requireUser } from '@/lib/auth'
import type { PersonalRecord } from '@/lib/pr-types'

type Row = {
  exercise_name: string
  category_name: string
  category_sort_order: number
  weight_kg: number
  reps: number | null
  achieved_on: string
}

/**
 * Personal records by exercise name, in one call to exercise_prs() (see the
 * v2 schema migration for the definition: heaviest completed set, ties to more
 * reps, then the earliest date; keyed by name so a lift catalogued under two
 * categories has one record).
 *
 * `excludeSessionId` leaves out the session being logged, so the record shown
 * beside an exercise is the one to beat, not one set a minute ago.
 */
export async function getPersonalRecords(
  names: string[],
  excludeSessionId?: string,
): Promise<Record<string, PersonalRecord>> {
  const unique = [...new Set(names)]
  if (unique.length === 0) return {}

  const { supabase } = await requireUser()
  const { data, error } = await supabase.rpc('exercise_prs', {
    p_names: unique,
    p_exclude_session: excludeSessionId ?? null,
  })
  if (error)
    throw new Error(`Failed to load personal records: ${error.message}`)

  const out: Record<string, PersonalRecord> = {}
  for (const row of (data ?? []) as Row[]) {
    // One row per category the name appears in; the record is identical.
    out[row.exercise_name] ??= {
      weight_kg: Number(row.weight_kg),
      reps: row.reps,
      achieved_on: row.achieved_on,
    }
  }
  return out
}
