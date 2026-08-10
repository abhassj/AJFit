'use server'

import { revalidatePath } from 'next/cache'

import { getOrCreateProgram } from '@/lib/program'
import { DAYS_OF_WEEK, localDateKey } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { secondsToInterval } from '@/lib/session-types'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function refresh(date: string) {
  revalidatePath(`/history/${date}`)
  revalidatePath('/')
}

/**
 * Creates a session for a past date that was never logged.
 *
 * start_time and end_time stay null: there is no real timer data for a workout
 * being written up after the fact, and inventing one would corrupt the duration
 * stats on Home.
 *
 * The program day used is the current living template's matching weekday, per
 * the "one living template, no versioning" decision (PRD §8.3) — editing the
 * program later changes what a backfill for an old date offers.
 */
export async function startBackfill(date: string): Promise<ActionResult> {
  if (!DATE_KEY.test(date)) return fail('Invalid date.')
  if (date > localDateKey()) return fail('That date is in the future.')

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fail('Not signed in.')

    const existing = await getSessionForDate(date)
    if (existing) return fail('That day already has a session.')

    const program = await getOrCreateProgram()
    const [y, m, d] = date.split('-').map(Number)
    const dow = DAYS_OF_WEEK[(new Date(y, m - 1, d).getDay() + 6) % 7]
    const day = program.days.find((x) => x.day_of_week === dow)

    if (!day) return fail('No program day for that date.')
    if (day.exercises.length === 0) {
      return fail(
        'That weekday has no exercises in your program. Add some first.',
      )
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: day.id,
        session_date: date,
        status: 'completed',
        start_time: null,
        end_time: null,
        paused_duration: secondsToInterval(0),
      })
      .select('id')
      .single()

    if (error || !session) {
      return fail(
        `Could not create the session: ${error?.message ?? 'unknown'}`,
      )
    }

    const { error: exErr } = await supabase.from('session_exercises').insert(
      day.exercises.map((exercise) => ({
        session_id: session.id,
        program_exercise_id: exercise.id,
        status: 'pending' as const,
      })),
    )

    if (exErr) return fail(`Could not prepare exercises: ${exErr.message}`)

    refresh(date)
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Removes a logged set — the correction path for an over-logged session. */
export async function deleteSet(
  setId: string,
  date: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) return fail(`Could not delete the set: ${error.message}`)
    refresh(date)
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Deletes a whole logged day, sets and all. */
export async function deleteSession(
  sessionId: string,
  date: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    // session_exercises and sets both cascade from sessions.
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
    if (error) return fail(`Could not delete the session: ${error.message}`)
    refresh(date)
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}
