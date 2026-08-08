'use server'

import { revalidatePath } from 'next/cache'

import { localDateKey } from '@/lib/program-types'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/** Records today's bodyweight as a new time-series entry (PRD §8.7). */
export async function logBodyweight(weight: number): Promise<ActionResult> {
  if (!Number.isFinite(weight) || weight <= 0) {
    return fail('Enter a weight greater than zero.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Not signed in.')

  const { error } = await supabase.from('weight_logs').insert({
    user_id: user.id,
    log_date: localDateKey(),
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
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) {
    return fail('Enter a goal greater than zero.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('Not signed in.')

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, goal_bodyweight: goal }, { onConflict: 'id' })

  if (error) return fail(`Could not save your goal: ${error.message}`)

  revalidatePath('/')
  return { ok: true }
}
