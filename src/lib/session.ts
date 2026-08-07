import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { localDateKey } from '@/lib/program-types'
import {
  intervalToSeconds,
  type SessionExercise,
  type WorkoutSession,
} from '@/lib/session-types'

const SESSION_SELECT = `
  id,
  session_date,
  status,
  start_time,
  end_time,
  paused_duration,
  session_exercises (
    id,
    program_exercise_id,
    status,
    completed_at,
    comment,
    program_exercises (
      exercise_order,
      prescribed_reps,
      exercises ( name )
    ),
    sets ( id, set_number, reps_done, weight )
  )
`

type RawSessionExercise = {
  id: string
  program_exercise_id: string
  status: SessionExercise['status']
  completed_at: string | null
  comment: string | null
  program_exercises: {
    exercise_order: number
    prescribed_reps: string | null
    exercises: { name: string } | null
  } | null
  sets: {
    id: string
    set_number: number
    reps_done: number | null
    weight: number | null
  }[]
}

function shapeSession(row: {
  id: string
  session_date: string
  status: WorkoutSession['status']
  start_time: string | null
  end_time: string | null
  paused_duration: unknown
  session_exercises: RawSessionExercise[]
}): WorkoutSession {
  return {
    id: row.id,
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
        exercise_name: se.program_exercises?.exercises?.name ?? 'Exercise',
        prescribed_reps: se.program_exercises?.prescribed_reps ?? null,
        exercise_order: se.program_exercises?.exercise_order ?? 0,
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
  date: string = localDateKey(),
): Promise<WorkoutSession | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', user.id)
    .eq('session_date', date)
    .order('start_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load session: ${error.message}`)
  if (!data) return null

  return shapeSession(data as unknown as Parameters<typeof shapeSession>[0])
}
