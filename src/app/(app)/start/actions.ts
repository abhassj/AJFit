'use server'

import { refresh } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'

import { requireSession, requireUser } from '@/lib/auth'
import { getOrCreateProgram } from '@/lib/program'
import { DAY_LABELS } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { intervalToSeconds, secondsToInterval } from '@/lib/session-types'
import { getViewerDateKey, getViewerDayOfWeek } from '@/lib/viewer-time'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/*
 * How these actions reach the screen.
 *
 * Starting, skipping and finishing change WHICH screen /start shows, so they
 * end with refresh(): one re-render of the current page.
 *
 * Everything that happens mid-session (logging a set, completing or skipping
 * an exercise, a comment, a pause) deliberately does not refresh at all. The
 * session runner shows the change the instant it is tapped and holds the
 * session in client state while it is on screen. These actions used to call
 * revalidatePath('/start'), which re-rendered the page and its layout and
 * re-ran the prefetch of every tab in the bottom bar: about twenty Supabase
 * requests per tap, ~1.7s before a set appeared at 200ms of latency. Now a
 * tap costs the one write it actually needs.
 *
 * The hot-path actions use requireSession() rather than requireUser(): they
 * never read user.id, and the database already authorises the write itself
 * (JWT verified by PostgREST, ownership by RLS). See src/lib/auth.ts.
 */

/**
 * Begins today's session and materialises one session_exercise per templated
 * exercise, so per-exercise status and comments have a row to live on from the
 * first tap.
 *
 * `programDayId` lets the user run a day that is not today's actual weekday —
 * training days slip, and the calendar weekday should not dictate which
 * workout you are allowed to do. It defaults to today's weekday. The session
 * still records the real calendar date; only the template it follows is
 * chosen. The picker sends the day's id rather than a weekday name because
 * that id is the one value the heading, the exercise list and the stored
 * session all derive from.
 */
export async function startSession(
  programDayId?: string,
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser()
    const date = await getViewerDateKey()

    // Independent reads, so in parallel: each is a round trip to the database.
    const [existing, program] = await Promise.all([
      getSessionForDate(date),
      getOrCreateProgram(),
    ])
    if (existing) return fail('A session already exists for today.')

    const todayDow = programDayId ? null : await getViewerDayOfWeek()
    // Only ever a day of the caller's own program: an id from anywhere else
    // is simply not found here.
    const day = program.days.find((d) =>
      programDayId ? d.id === programDayId : d.day_of_week === todayDow,
    )
    if (!day) return fail('No program day for that selection.')
    const label = DAY_LABELS[day.day_of_week]
    if (day.is_rest_day) {
      return fail(`${label} is a rest day in your split.`)
    }
    if (day.exercises.length === 0) {
      return fail(`${label} has no exercises. Add some in My Workout Split.`)
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
          // Snapshot of what is being performed; see the v2 schema migration.
          exercise_id: exercise.exercise_id,
          status: 'pending' as const,
        })),
      )

    if (exercisesError) {
      return fail(`Could not prepare exercises: ${exercisesError.message}`)
    }

    refresh()
    return { ok: true }
  } catch (e) {
    // requireUser() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
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
    const date = await getViewerDateKey()

    const [existing, program] = await Promise.all([
      getSessionForDate(date),
      getOrCreateProgram(),
    ])
    if (existing) return fail('A session already exists for today.')

    const viewerDow = await getViewerDayOfWeek()
    const day = program.days.find((d) => d.day_of_week === viewerDow)

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
    // requireUser() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

/**
 * Records one set.
 *
 * The client chooses the row id and the set number. That makes the write a
 * single round trip (no read of the last set_number first) and makes it
 * idempotent: if a save is retried after a dropped connection, the duplicate
 * insert is ignored rather than logging the set twice. The set number is safe
 * to take from the client because a session is logged on one device, in
 * order, through the runner's write queue.
 */
export async function logSet(
  setId: string,
  sessionExerciseId: string,
  setNumber: number,
  reps: number | null,
  weight: number | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession()

    const { error } = await supabase.from('sets').upsert(
      {
        id: setId,
        session_exercise_id: sessionExerciseId,
        set_number: setNumber,
        reps_done: reps,
        weight,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

    if (error) return fail(`Could not log the set: ${error.message}`)
    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals
    // by throwing; let it through.
    unstable_rethrow(e)
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
    const { supabase } = await requireSession()
    const { error } = await supabase
      .from('sets')
      .update({ reps_done: reps, weight })
      .eq('id', setId)

    if (error) return fail(`Could not update the set: ${error.message}`)

    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
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
    const { supabase } = await requireSession()
    const { error } = await supabase
      .from('session_exercises')
      .update({
        status,
        completed_at: status === 'pending' ? null : new Date().toISOString(),
      })
      .eq('id', sessionExerciseId)

    if (error) return fail(`Could not update the exercise: ${error.message}`)

    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}

export async function saveComment(
  sessionExerciseId: string,
  comment: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession()
    const { error } = await supabase
      .from('session_exercises')
      .update({ comment: comment.trim() || null })
      .eq('id', sessionExerciseId)

    if (error) return fail(`Could not save the comment: ${error.message}`)

    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
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
    const { supabase } = await requireSession()

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

    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
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

    const { supabase } = await requireSession()
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed', end_time: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) return fail(`Could not finish the session: ${error.message}`)

    refresh()
    return { ok: true }
  } catch (e) {
    // requireSession() redirects an expired session, and redirect() signals by
    // throwing. Without this the catch would swallow it and report the
    // framework's internal marker as a failed save.
    unstable_rethrow(e)
    return fail(e instanceof Error ? e.message : 'Unexpected error')
  }
}
