import 'server-only'

import { requireUser } from '@/lib/auth'
import type { PersonalRecord } from '@/lib/pr-types'

type Row = {
  exercise_name: string
  category_name: string
  category_sort_order: number
  weight_kg: number | null
  reps: number | null
  achieved_on: string
  /** Added by migration 20261013130000. */
  pr_kind: 'weight' | 'reps'
}

/** A row as the app's record type; reps records carry no weight. */
function toRecord(row: Row): PersonalRecord {
  return row.pr_kind === 'reps'
    ? {
        kind: 'reps',
        weight_kg: null,
        reps: row.reps ?? 0,
        achieved_on: row.achieved_on,
      }
    : {
        kind: 'weight',
        weight_kg: Number(row.weight_kg),
        reps: row.reps,
        achieved_on: row.achieved_on,
      }
}

/**
 * Personal records by exercise name, in one call to exercise_prs() (see
 * migrations 20261010120000 and 20261013130000: heaviest completed set, ties
 * to more reps, then the earliest date — or, for an exercise never done with
 * weight, the most reps in one set; keyed by name so a lift catalogued under
 * two categories has one record).
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
    p_include_reps: true,
  })
  if (error)
    throw new Error(`Failed to load personal records: ${error.message}`)

  const out: Record<string, PersonalRecord> = {}
  for (const row of (data ?? []) as Row[]) {
    // One row per category the name appears in; the record is identical.
    out[row.exercise_name] ??= toRecord(row)
  }
  return out
}

export type RecordsByCategory = {
  category: string
  records: (PersonalRecord & { exercise_name: string })[]
}[]

/**
 * Every personal record, grouped under the catalog's categories in their
 * catalog order (D5: a lift listed in two categories appears in both, with
 * the same record). One call to exercise_prs().
 */
export async function getRecordsByCategory(): Promise<RecordsByCategory> {
  const { supabase } = await requireUser()
  const { data, error } = await supabase.rpc('exercise_prs', {
    p_include_reps: true,
  })
  if (error)
    throw new Error(`Failed to load personal records: ${error.message}`)

  const groups = new Map<string, RecordsByCategory[number]>()
  // The function already orders by category sort order, then name.
  for (const row of (data ?? []) as Row[]) {
    let group = groups.get(row.category_name)
    if (!group) {
      group = { category: row.category_name, records: [] }
      groups.set(row.category_name, group)
    }
    group.records.push({ ...toRecord(row), exercise_name: row.exercise_name })
  }
  return [...groups.values()]
}
