import type {
  SessionExercise,
  SessionExerciseStatus,
} from '@/lib/session-types'

/*
 * Every change the live session runner makes, as plain data.
 *
 * The runner used to queue closures. Data can be written to sessionStorage
 * and read back after a reload, and that is the point: when a deploy lands
 * mid-workout, the old page's Server Action ids stop existing (Next recalculates
 * them per build), so the next save fails with "Server Action not found". The
 * queue then stores whatever is unsaved, reloads onto the new build, and the
 * runner replays it — in order, through the new build's actions.
 *
 * Pure, so it can be tested and replayed without a server; the dispatcher
 * that sends a write lives in src/lib/session-writes.ts.
 */
export type SessionWrite =
  | {
      kind: 'logSet'
      setId: string
      exerciseId: string
      setNumber: number
      reps: number | null
      weight: number | null
    }
  | {
      kind: 'updateSet'
      setId: string
      exerciseId: string
      reps: number | null
      weight: number | null
    }
  | {
      kind: 'status'
      exerciseId: string
      status: SessionExerciseStatus
      completedAt: string | null
    }
  | { kind: 'comment'; exerciseId: string; comment: string }
  | { kind: 'pause'; seconds: number }

/** What the save-status banner calls a write. */
export function describeWrite(write: SessionWrite): string {
  switch (write.kind) {
    case 'logSet':
      return `Set ${write.setNumber}`
    case 'updateSet':
      return 'Set correction'
    case 'status':
      return write.status === 'skipped' ? 'Skip' : 'Completion'
    case 'comment':
      return 'Comment'
    case 'pause':
      return 'Pause'
  }
}

/**
 * Applies a write to the runner's exercises. The same function serves a live
 * tap and a replay after reload, so both produce the identical screen.
 * Pauses do not touch exercises; the runner tracks them separately.
 */
export function applyWrite(
  exercises: SessionExercise[],
  write: SessionWrite,
): SessionExercise[] {
  if (write.kind === 'pause') return exercises
  return exercises.map((e) => {
    if (e.id !== write.exerciseId) return e
    switch (write.kind) {
      case 'logSet':
        // A replay of a set the server already has must not show twice.
        if (e.sets.some((s) => s.id === write.setId)) return e
        return {
          ...e,
          sets: [
            ...e.sets,
            {
              id: write.setId,
              set_number: write.setNumber,
              reps_done: write.reps,
              weight: write.weight,
            },
          ],
        }
      case 'updateSet':
        return {
          ...e,
          sets: e.sets.map((s) =>
            s.id === write.setId
              ? { ...s, reps_done: write.reps, weight: write.weight }
              : s,
          ),
        }
      case 'status':
        return { ...e, status: write.status, completed_at: write.completedAt }
      case 'comment':
        return { ...e, comment: write.comment.trim() || null }
    }
  })
}
