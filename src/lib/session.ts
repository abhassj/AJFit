import 'server-only'

import { requireUser } from '@/lib/auth'
import type { DayOfWeek } from '@/lib/program-types'
import {
  intervalToSeconds,
  type SessionExercise,
  type WorkoutSession,
} from '@/lib/session-types'
import { getViewerDateKey } from '@/lib/viewer-time'

/*
 * The workout's title comes from the session's own program_day — the day the
 * user chose to run — never from today's weekday. Deriving it from the weekday
 * is what put "Back & Biceps" over a Shoulders & Legs session whenever someone
 * ran a different day's workout.
 *
 * Likewise the exercise name, its order and its prescribed reps come from the
 * session_exercise's own snapshot, not from whatever the program slot holds
 * now — the slot may since have changed or been removed from the Split. Only
 * rest_seconds is read live, because it drives the live rest timer.
 */
const SESSION_SELECT = `
  id,
  program_day_id,
  session_date,
  status,
  start_time,
  end_time,
  paused_duration,
  program_days ( title, day_of_week ),
  session_exercises (
    id,
    program_exercise_id,
    status,
    completed_at,
    comment,
    exercise_order,
    prescribed_reps,
    exercises ( name ),
    program_exercises ( rest_seconds ),
    sets ( id, set_number, reps_done, weight )
  )
`

type RawSessionExercise = {
  id: string
  program_exercise_id: string | null
  status: SessionExercise['status']
  completed_at: string | null
  comment: string | null
  exercise_order: number | null
  prescribed_reps: string | null
  exercises: { name: string } | null
  /** Null once the slot is removed from the Split; only rest_seconds is live. */
  program_exercises: { rest_seconds: number | null } | null
  sets: {
    id: string
    set_number: number
    reps_done: number | null
    weight: number | null
  }[]
}

function shapeSession(row: {
  id: string
  program_day_id: string | null
  program_days: { title: string | null; day_of_week: DayOfWeek } | null
  session_date: string
  status: WorkoutSession['status']
  start_time: string | null
  end_time: string | null
  paused_duration: unknown
  session_exercises: RawSessionExercise[]
}): WorkoutSession {
  return {
    id: row.id,
    program_day_id: row.program_day_id,
    day_title: row.program_days?.title?.trim() || null,
    day_of_week: row.program_days?.day_of_week ?? null,
    session_date: row.session_date,
    status: row.status,
    start_time: row.start_time,
    end_time: row.end_time,
    paused_seconds: intervalToSeconds(row.paused_duration),
    exercises: (row.session_exercises ?? [])
      .map((se) => ({
        id: se.id,
        program_exercise_id: se.program_exercise_id,
        status: se.status,
        completed_at: se.completed_at,
        comment: se.comment,
        exercise_name: se.exercises?.name ?? 'Exercise',
        prescribed_reps: se.prescribed_reps,
        rest_seconds: se.program_exercises?.rest_seconds ?? null,
        exercise_order: se.exercise_order ?? 0,
        sets: [...(se.sets ?? [])].sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => a.exercise_order - b.exercise_order),
  }
}

/**
 * The session for a given date, if one exists. A day has at most one session:
 * either in progress, completed, or explicitly skipped.
 */
export async function getSessionForDate(
  /** Defaults to the viewer's today, resolved in their own timezone. */
  date?: string,
): Promise<WorkoutSession | null> {
  const { supabase, user } = await requireUser()
  const day = date ?? (await getViewerDateKey())

  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .eq('session_date', day)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load session: ${error.message}`)
  if (!data) return null

  return shapeSession(data as unknown as Parameters<typeof shapeSession>[0])
}
