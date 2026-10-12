'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { isPlausibleBodyweightKg } from '@/lib/validation'
import { getViewerDateKey } from '@/lib/viewer-time'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/**
 * Records today's bodyweight as a new time-series entry (PRD §8.7).
 * `weight` is kilograms; the form converts from the user's unit (D1).
 */
export async function logBodyweight(weight: number): Promise<ActionResult> {
  if (!isPlausibleBodyweightKg(weight)) {
    return fail('Enter a realistic weight.')
  }

  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('weight_logs').insert({
    user_id: user.id,
    log_date: await getViewerDateKey(),
    weight,
  })

  if (error) return fail(`Could not save your weight: ${error.message}`)

  revalidatePath('/')
  return { ok: true }
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
