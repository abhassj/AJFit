/**
 * Session shapes and pure helpers, free of server-only imports so Client
 * Components can use them. Queries and mutations live in `@/lib/session`.
 */

export type SessionStatus = 'in_progress' | 'completed' | 'skipped'
export type SessionExerciseStatus = 'pending' | 'completed' | 'skipped'

export type LoggedSet = {
  id: string
  set_number: number
  reps_done: number | null
  weight: number | null
}

export type SessionExercise = {
  id: string
  program_exercise_id: string
  status: SessionExerciseStatus
  completed_at: string | null
  comment: string | null
  /** From the template, for display. */
  exercise_name: string
  prescribed_reps: string | null
  exercise_order: number
  sets: LoggedSet[]
}

export type WorkoutSession = {
  id: string
  session_date: string
  status: SessionStatus
  start_time: string | null
  end_time: string | null
  /** Postgres interval, normalised to whole seconds by the query. */
  paused_seconds: number
  exercises: SessionExercise[]
}

/**
 * Elapsed working time in seconds: wall clock since start, minus time spent
 * paused. `pausedSince` is set while the timer is currently paused, so the
 * in-flight pause is excluded too.
 */
export function elapsedSeconds(
  startTime: string | null,
  pausedSeconds: number,
  pausedSince: string | null,
  now: number = Date.now(),
): number {
  if (!startTime) return 0
  const started = new Date(startTime).getTime()
  const wall = Math.max(0, Math.floor((now - started) / 1000))
  const inFlight = pausedSince
    ? Math.max(0, Math.floor((now - new Date(pausedSince).getTime()) / 1000))
    : 0
  return Math.max(0, wall - pausedSeconds - inFlight)
}

/** hh:mm:ss, matching the mockup's large monospaced timer. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** "1:37 PM", matching the completed-item log in the mockup. */
export function formatClockTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Parses a Postgres interval (or seconds) into whole seconds. */
export function intervalToSeconds(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return Math.floor(value)
  const text = String(value).trim()
  if (!text) return 0

  // Postgres renders intervals as "HH:MM:SS(.ffffff)", optionally with a
  // leading "N days" component.
  let seconds = 0
  const days = text.match(/(-?\d+)\s+day/)
  if (days) seconds += Number(days[1]) * 86400
  const clock = text.match(/(-?\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
  if (clock) {
    const sign = clock[1].startsWith('-') ? -1 : 1
    seconds +=
      sign *
      (Math.abs(Number(clock[1])) * 3600 +
        Number(clock[2]) * 60 +
        Math.floor(Number(clock[3])))
  } else if (/^-?\d+(\.\d+)?$/.test(text)) {
    seconds += Math.floor(Number(text))
  }
  return seconds
}

/** Whole seconds as a Postgres interval literal. */
export function secondsToInterval(seconds: number): string {
  return `${Math.max(0, Math.floor(seconds))} seconds`
}
