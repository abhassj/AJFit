/** Pure PR shapes and helpers, safe for Client Components. */

export type PersonalRecord = {
  /** Always kilograms; convert for display. */
  weight_kg: number
  reps: number | null
  achieved_on: string
}

type Lift = { weight: number | null; reps_done: number | null }

/** Heavier wins; at equal weight, more reps wins. */
function beats(a: Lift, best: { weight: number; reps: number | null }) {
  if (a.weight == null) return false
  if (a.weight > best.weight) return true
  return a.weight === best.weight && (a.reps_done ?? 0) > (best.reps ?? 0)
}

/**
 * Whether `set` is a new personal record: it beats the stored record and every
 * set before it in this session (so only the set that actually raised the bar
 * is marked, not each one after it).
 *
 * With no stored record there is nothing to beat yet, so no badge — the first
 * weighted set simply becomes the record once the session is finished.
 */
export function isNewRecord(
  set: Lift,
  earlier: Lift[],
  record: PersonalRecord | undefined,
): boolean {
  if (!record || set.weight == null || set.weight <= 0) return false
  let best = { weight: record.weight_kg, reps: record.reps }
  for (const e of earlier) {
    if (beats(e, best)) best = { weight: e.weight!, reps: e.reps_done }
  }
  return beats(set, best)
}
