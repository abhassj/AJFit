import {
  logSet,
  saveComment,
  setExerciseStatus,
  setPausedTotal,
  updateSet,
  type ActionResult,
} from '@/app/(app)/start/actions'
import type { SessionWrite } from '@/lib/session-write-types'

export {
  applyWrite,
  describeWrite,
  type SessionWrite,
} from '@/lib/session-write-types'

/** Sends one write to the server. */
export function runWrite(
  sessionId: string,
  write: SessionWrite,
): Promise<ActionResult> {
  switch (write.kind) {
    case 'logSet':
      return logSet(
        write.setId,
        write.exerciseId,
        write.setNumber,
        write.reps,
        write.weight,
      )
    case 'updateSet':
      return updateSet(write.setId, write.reps, write.weight)
    case 'status':
      return setExerciseStatus(write.exerciseId, write.status)
    case 'comment':
      return saveComment(write.exerciseId, write.comment)
    case 'pause':
      return setPausedTotal(sessionId, write.totalSeconds)
  }
}
