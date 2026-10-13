/** Pure PR shapes and helpers, safe for Client Components. */

import { formatWeight, type WeightUnit } from '@/lib/units'

/**
 * A personal record, as exercise_prs() reports it (migration
 * 20261013130000):
 *   weight — the exercise has weighted sets: heaviest, ties to more reps.
 *   reps   — it has only sets without weight: most reps in one set.
 */
export type PersonalRecord =
  | {
      kind: 'weight'
      /** Always kilograms; convert for display. */
      weight_kg: number
      reps: number | null
      achieved_on: string
    }
  | {
      kind: 'reps'
      weight_kg: null
      reps: number
      achieved_on: string
    }

type Lift = { weight: number | null; reps_done: number | null }

/** The record's text, e.g. "60 kg × 8" or "17 REPS". Reps never convert. */
export function formatRecord(record: PersonalRecord, unit: WeightUnit): string {
  if (record.kind === 'reps') return `${record.reps} REPS`
  return `${formatWeight(record.weight_kg, unit)}${record.reps ? ` × ${record.reps}` : ''}`
}

const hasWeight = (l: Lift) => l.weight != null && l.weight > 0

/**
 * Whether `set` is a new personal record: it beats the stored record and every
 * set before it in this session, so only the set that actually raised the bar
 * is marked.
 *
 *   weight record — a heavier set, or the same weight for more reps.
 *   reps record   — a set without weight and with more reps.
 *
 * With no stored record there is nothing to beat yet, so no badge. A weighted
 * set against a reps record is not compared: the first weighted set becomes a
 * weight record once the session is finished, as with no record at all.
 */
export function isNewRecord(
  set: Lift,
  earlier: Lift[],
  record: PersonalRecord | undefined,
): boolean {
  if (!record) return false

  if (record.kind === 'reps') {
    if (hasWeight(set) || set.reps_done == null) return false
    let best = record.reps
    for (const e of earlier) {
      if (!hasWeight(e) && e.reps_done != null && e.reps_done > best) {
        best = e.reps_done
      }
    }
    return set.reps_done > best
  }

  if (!hasWeight(set)) return false
  const beats = (a: Lift, best: { weight: number; reps: number | null }) =>
    hasWeight(a) &&
    (a.weight! > best.weight ||
      (a.weight === best.weight && (a.reps_done ?? 0) > (best.reps ?? 0)))
  let best = { weight: record.weight_kg, reps: record.reps }
  for (const e of earlier) {
    if (beats(e, best)) best = { weight: e.weight!, reps: e.reps_done }
  }
  return beats(set, best)
}
