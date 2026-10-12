'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { isPlausibleBodyweightKg } from '@/lib/validation'
import { getViewerDateKey } from '@/lib/viewer-time'

export type ActionResult = { ok: true } | { ok: false; error: string }

/** `replaced`: today already had an entry, and this one took its place. */
export type BodyweightResult =
  { ok: true; replaced: boolean } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/**
 * Records today's bodyweight (PRD §8.7). `weight` is kilograms; the form
 * converts from the user's unit (D1).
 *
 * One entry per day: a second entry on the same date replaces the first
 * (migration 20261013120000), so "current" bodyweight — and BMI — is always the
 * last thing entered. The upsert says so explicitly; the table's BEFORE INSERT
 * trigger does the same for any plain insert.
 */
export async function logBodyweight(weight: number): Promise<BodyweightResult> {
  if (!isPlausibleBodyweightKg(weight)) {
    return { ok: false, error: 'Enter a realistic weight.' }
  }

  const { supabase, user } = await requireUser()
  const logDate = await getViewerDateKey()

  // Only to tell the user whether this replaced today's entry.
  const { data: existing, error: readError } = await supabase
    .from('weight_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle()
  if (readError) {
    return {
      ok: false,
      error: `Could not save your weight: ${readError.message}`,
    }
  }

  const { error } = await supabase
    .from('weight_logs')
    .upsert(
      { user_id: user.id, log_date: logDate, weight },
      { onConflict: 'user_id,log_date' },
    )

  if (error) {
    return { ok: false, error: `Could not save your weight: ${error.message}` }
  }

  revalidatePath('/')
  revalidatePath('/profile')
  return { ok: true, replaced: !!existing }
}

/**
 * Saves the goal bodyweight.
 *
 * Nothing creates a profiles row at signup, so this upserts rather than
 * assuming one exists. `id` is the primary key and references auth.users, so
 * the conflict target is the user themselves.
 */
export async function saveGoalBodyweight(
  goal: number | null,
): Promise<ActionResult> {
  // Kilograms, like every stored weight.
  if (goal !== null && !isPlausibleBodyweightKg(goal)) {
    return fail('Enter a realistic goal.')
  }

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, goal_bodyweight: goal }, { onConflict: 'id' })

  if (error) return fail(`Could not save your goal: ${error.message}`)

  revalidatePath('/')
  return { ok: true }
}
