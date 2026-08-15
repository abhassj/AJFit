'use server'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'

import { getOrCreateProgram } from '@/lib/program'
import { DAY_LABELS, DAYS_OF_WEEK, type DayOfWeek } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { requireUser } from '@/lib/auth'
import { secondsToInterval } from '@/lib/session-types'
import { getViewerDateKey } from '@/lib/viewer-time'

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
export async function startBackfill(
  date: string,
  programDayOfWeek?: DayOfWeek,
): Promise<ActionResult> {
  if (!DATE_KEY.test(date)) return fail('Invalid date.')
  if (date > (await getViewerDateKey()))
    return fail('That date is in the future.')

  try {
    const { supabase, user } = await requireUser()

    const existing = await getSessionForDate(date)
    if (existing) return fail('That day already has a session.')

    const program = await getOrCreateProgram()
    const [y, m, d] = date.split('-').map(Number)
    const calendarDow = DAYS_OF_WEEK[(new Date(y, m - 1, d).getDay() + 6) % 7]
    // Same flexibility as starting a live session: someone writing up a missed
    // day should be able to record the workout they actually did, not whatever
    // the calendar weekday happens to prescribe.
    const dow = programDayOfWeek ?? calendarDow
    const day = program.days.find((x) => x.day_of_week === dow)

    if (!day) return fail('No program day for that selection.')
    if (day.exercises.length === 0) {
      return fail(
        `${DAY_LABELS[dow]} has no exercises in your program. Add some first.`,
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
    // Let redirect() from requireUser() through — see start/actions.ts.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Removes a logged set — the correction path for an over-logged session. */
export async function deleteSet(
  setId: string,
  date: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) return fail(`Could not delete the set: ${error.message}`)
    refresh(date)
    return { ok: true }
  } catch (e) {
    // Let redirect() from requireUser() through — see start/actions.ts.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Deletes a whole logged day, sets and all. */
export async function deleteSession(
  sessionId: string,
  date: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    // session_exercises and sets both cascade from sessions.
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
    if (error) return fail(`Could not delete the session: ${error.message}`)
    refresh(date)
    return { ok: true }
  } catch (e) {
    // Let redirect() from requireUser() through — see start/actions.ts.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}
