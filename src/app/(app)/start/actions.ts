'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateProgram } from '@/lib/program'
import {
  DAY_LABELS,
  localDateKey,
  todayDayOfWeek,
  type DayOfWeek,
} from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { intervalToSeconds, secondsToInterval } from '@/lib/session-types'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return { supabase, user }
}

function refresh() {
  revalidatePath('/start')
}

/**
 * Begins today's session and materialises one session_exercise per templated
 * exercise, so per-exercise status and comments have a row to live on from the
 * first tap.
 *
 * `programDayOfWeek` lets the user run a day that is not today's actual
 * weekday — training days slip, and the calendar weekday should not dictate
 * which workout you are allowed to do. It defaults to today's weekday.
 * The session still records the real calendar date; only the template it
 * follows is chosen.
 */
export async function startSession(
  programDayOfWeek?: DayOfWeek,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()
    const date = localDateKey()

    const existing = await getSessionForDate(date)
    if (existing) return fail('A session already exists for today.')

    const program = await getOrCreateProgram()
    const chosen = programDayOfWeek ?? todayDayOfWeek()
    const day = program.days.find((d) => d.day_of_week === chosen)
    if (!day) return fail('No program day for that selection.')
    if (day.is_rest_day) {
      return fail(`${DAY_LABELS[chosen]} is a rest day in your program.`)
    }
    if (day.exercises.length === 0) {
      return fail(
        `${DAY_LABELS[chosen]} has no exercises. Add some in the Program builder.`,
      )
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: day.id,
        session_date: date,
        status: 'in_progress',
        start_time: new Date().toISOString(),
        paused_duration: secondsToInterval(0),
      })
      .select('id')
      .single()

    if (error || !session) {
      return fail(`Could not start the session: ${error?.message ?? 'unknown'}`)
    }

    const { error: exercisesError } = await supabase
      .from('session_exercises')
      .insert(
        day.exercises.map((exercise) => ({
          session_id: session.id,
          program_exercise_id: exercise.id,
          status: 'pending' as const,
        })),
      )

    if (exercisesError) {
      return fail(`Could not prepare exercises: ${exercisesError.message}`)
    }

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/**
 * Records an intentional whole-day skip: a dated row with no exercises and no
 * sets, which is what distinguishes "I chose to rest" from "never logged"
 * (PRD §8.4).
 */
export async function skipDay(): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()
    const date = localDateKey()

    const existing = await getSessionForDate(date)
    if (existing) return fail('A session already exists for today.')

    const program = await getOrCreateProgram()
    const day = program.days.find((d) => d.day_of_week === todayDayOfWeek())

    const { error } = await supabase.from('sessions').insert({
      user_id: user.id,
      program_day_id: day?.id ?? null,
      session_date: date,
      status: 'skipped',
      paused_duration: secondsToInterval(0),
    })

    if (error) return fail(`Could not skip the day: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Appends a set, numbering it after whatever is already logged. */
export async function logSet(
  sessionExerciseId: string,
  reps: number | null,
  weight: number | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()

    const { data: last, error: lastError } = await supabase
      .from('sets')
      .select('set_number')
      .eq('session_exercise_id', sessionExerciseId)
      .order('set_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastError)
      return fail(`Could not read existing sets: ${lastError.message}`)

    const { error } = await supabase.from('sets').insert({
      session_exercise_id: sessionExerciseId,
      set_number: (last?.set_number ?? 0) + 1,
      reps_done: reps,
      weight,
    })

    if (error) return fail(`Could not log the set: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Corrects an already-logged set, used by the "Previous Set" action. */
export async function updateSet(
  setId: string,
  reps: number | null,
  weight: number | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { error } = await supabase
      .from('sets')
      .update({ reps_done: reps, weight })
      .eq('id', setId)

    if (error) return fail(`Could not update the set: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/**
 * Marks an exercise complete or explicitly skipped. Both stamp completed_at —
 * for a skip it records when the decision was made, which is what the session
 * log's timestamp shows.
 */
export async function setExerciseStatus(
  sessionExerciseId: string,
  status: 'completed' | 'skipped' | 'pending',
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { error } = await supabase
      .from('session_exercises')
      .update({
        status,
        completed_at: status === 'pending' ? null : new Date().toISOString(),
      })
      .eq('id', sessionExerciseId)

    if (error) return fail(`Could not update the exercise: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

export async function saveComment(
  sessionExerciseId: string,
  comment: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser()
    const { error } = await supabase
      .from('session_exercises')
      .update({ comment: comment.trim() || null })
      .eq('id', sessionExerciseId)

    if (error) return fail(`Could not save the comment: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/**
 * Accumulates a completed pause into paused_duration.
 *
 * The schema has no "paused since" column, so the client holds the in-flight
 * pause and reports its length on resume (or on finish, if the user finishes
 * while still paused). Read-modify-write is safe here because a session belongs
 * to one user on one device at a time.
 */
export async function addPausedSeconds(
  sessionId: string,
  seconds: number,
): Promise<ActionResult> {
  try {
    if (!Number.isFinite(seconds) || seconds <= 0) return { ok: true }
    const { supabase } = await requireUser()

    const { data: current, error: readError } = await supabase
      .from('sessions')
      .select('paused_duration')
      .eq('id', sessionId)
      .single()

    if (readError || !current) {
      return fail(
        `Could not read the timer: ${readError?.message ?? 'unknown'}`,
      )
    }

    const total =
      intervalToSeconds(current.paused_duration) + Math.floor(seconds)

    const { error } = await supabase
      .from('sessions')
      .update({ paused_duration: secondsToInterval(total) })
      .eq('id', sessionId)

    if (error) return fail(`Could not update the timer: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/** Closes the session out, folding in any pause still running. */
export async function finishSession(
  sessionId: string,
  trailingPausedSeconds = 0,
): Promise<ActionResult> {
  try {
    if (trailingPausedSeconds > 0) {
      const result = await addPausedSeconds(sessionId, trailingPausedSeconds)
      if (!result.ok) return result
    }

    const { supabase } = await requireUser()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed', end_time: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) return fail(`Could not finish the session: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}
