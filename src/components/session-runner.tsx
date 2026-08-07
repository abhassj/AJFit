'use client'

import { useMemo, useState, useTransition } from 'react'

import {
  addPausedSeconds,
  finishSession,
  logSet,
  saveComment,
  setExerciseStatus,
  updateSet,
} from '@/app/(app)/start/actions'
import {
  CheckIcon,
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
} from '@/components/icons'
import { NumericEntry, type NumericField } from '@/components/numeric-keypad'
import { ActionButton, Banner, TripleActionRow } from '@/components/ui'
import {
  elapsedSeconds,
  formatClockTime,
  formatDuration,
  type SessionExercise,
  type WorkoutSession,
} from '@/lib/session-types'
import { useNow } from '@/lib/use-now'

export function SessionRunner({
  session,
  dayTitle,
}: {
  session: WorkoutSession
  dayTitle: string
}) {
  const [pausedSince, setPausedSince] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(
    session.exercises.find((e) => e.status === 'pending')?.id ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Ticks once a second; 0 until mounted, so SSR and first paint agree.
  const now = useNow()

  const seconds = useMemo(
    () =>
      now === 0
        ? 0
        : elapsedSeconds(
            session.start_time,
            session.paused_seconds,
            pausedSince,
            now,
          ),
    [session.start_time, session.paused_seconds, pausedSince, now],
  )

  /*
   * The panel follows the selected exercise only while it is still pending.
   * Once it is completed or skipped it drops out and the next pending one takes
   * over, so logging never silently keeps writing to an exercise the user has
   * already closed out. Falling through like this avoids an effect that would
   * have to chase the server state after every revalidation.
   */
  const active =
    session.exercises.find(
      (e) => e.id === activeId && e.status === 'pending',
    ) ??
    session.exercises.find((e) => e.status === 'pending') ??
    null
  // "Up Next" is everything still pending other than the one on screen.
  const remaining = session.exercises.filter(
    (e) => e.status === 'pending' && e.id !== active?.id,
  )
  const logged = session.exercises.filter((e) => e.status !== 'pending')

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error)
    })
  }

  function handlePause() {
    if (pausedSince) return
    setPausedSince(new Date().toISOString())
  }

  function handleResume() {
    if (!pausedSince) return
    const elapsed = Math.floor(
      (Date.now() - new Date(pausedSince).getTime()) / 1000,
    )
    setPausedSince(null)
    run(() => addPausedSeconds(session.id, elapsed))
  }

  function handleFinish() {
    const trailing = pausedSince
      ? Math.floor((Date.now() - new Date(pausedSince).getTime()) / 1000)
      : 0
    setPausedSince(null)
    run(() => finishSession(session.id, trailing))
  }

  return (
    <main className="px-4 pt-6 pb-4">
      <header className="px-1 pb-5">
        <p className="label-caps">Logging Session</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          {dayTitle}
        </h1>
      </header>

      {error && (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      {/* Session timer + the doc's triple-button action row. */}
      <section className="surface rounded-2xl p-5">
        <h2 className="label-caps text-center">Session Timer</h2>
        <p
          className="mt-2 text-center font-mono text-[38px] leading-none font-bold tracking-tight text-primary tabular-nums"
          aria-live="off"
        >
          {formatDuration(seconds)}
        </p>
        {pausedSince && (
          <p className="mt-2 text-center text-[13px] font-semibold text-danger">
            Paused
          </p>
        )}

        <div className="mt-4">
          <TripleActionRow>
            <ActionButton onClick={handlePause} disabled={!!pausedSince}>
              <PauseIcon className="h-5 w-5" />
              Pause
            </ActionButton>
            <ActionButton onClick={handleResume} disabled={!pausedSince}>
              <PlayIcon className="h-5 w-5" />
              Resume
            </ActionButton>
            <ActionButton tone="danger" onClick={handleFinish}>
              <CheckIcon className="h-5 w-5" />
              Finish
            </ActionButton>
          </TripleActionRow>
        </div>
      </section>

      {active ? (
        <ExercisePanel
          key={active.id}
          exercise={active}
          index={session.exercises.findIndex((e) => e.id === active.id) + 1}
          total={session.exercises.length}
          onRun={run}
        />
      ) : (
        remaining.length === 0 && (
          <p className="surface mt-3 rounded-2xl px-5 py-6 text-center text-sm text-secondary">
            Every exercise is logged. Tap Finish to close out the session.
          </p>
        )
      )}

      {remaining.length > 0 && (
        <section className="mt-3">
          <h2 className="label-caps px-1 pb-2">Up Next</h2>
          <div className="surface overflow-hidden rounded-2xl">
            <ul>
              {remaining.map((exercise) => (
                <li
                  key={exercise.id}
                  className="border-t border-hairline/60 first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(exercise.id)}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors ${
                      exercise.id === activeId ? 'bg-card-raised' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-primary">
                        {exercise.exercise_name}
                      </span>
                      {exercise.prescribed_reps && (
                        <span className="mt-0.5 block text-[13px] text-secondary">
                          {exercise.prescribed_reps}
                        </span>
                      )}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 shrink-0 -rotate-90 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {logged.length > 0 && <SessionLog exercises={logged} />}
    </main>
  )
}

/** The design doc's completed-item log: checkmark, name, timestamp. */
function SessionLog({ exercises }: { exercises: SessionExercise[] }) {
  return (
    <section className="mt-3">
      <h2 className="label-caps px-1 pb-2">Session Log</h2>
      <div className="surface overflow-hidden rounded-2xl">
        <ul>
          {exercises.map((exercise) => {
            const skipped = exercise.status === 'skipped'
            return (
              <li
                key={exercise.id}
                className="flex items-start gap-3 border-t border-hairline/60 px-5 py-3.5 first:border-t-0"
              >
                {skipped ? (
                  <SkipIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
                ) : (
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-primary">
                    {exercise.exercise_name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-secondary">
                    {skipped ? 'Skipped' : 'Completed'} at{' '}
                    {formatClockTime(exercise.completed_at)}
                    {exercise.sets.length > 0 &&
                      ` · ${exercise.sets.length} set${exercise.sets.length === 1 ? '' : 's'}`}
                  </p>
                  {exercise.sets.length > 0 && (
                    <p className="mt-1 text-[13px] text-faint tabular-nums">
                      {exercise.sets
                        .map((s) => `${s.reps_done ?? '—'}×${s.weight ?? '—'}`)
                        .join('  ·  ')}
                    </p>
                  )}
                  {exercise.comment && (
                    <p className="mt-1.5 text-[13px] text-secondary italic">
                      “{exercise.comment}”
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function ExercisePanel({
  exercise,
  index,
  total,
  onRun,
}: {
  exercise: SessionExercise
  index: number
  total: number
  onRun: (
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => void
}) {
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [field, setField] = useState<NumericField>('reps')
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [comment, setComment] = useState(exercise.comment ?? '')
  const [showComment, setShowComment] = useState(!!exercise.comment)

  const toNumber = (value: string) => {
    if (value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  function clear() {
    setReps('')
    setWeight('')
    setField('reps')
    setEditingSetId(null)
  }

  function handleDone() {
    const r = toNumber(reps)
    const w = toNumber(weight)
    if (r === null && w === null) return

    if (editingSetId) {
      const id = editingSetId
      onRun(() => updateSet(id, r, w))
    } else {
      onRun(() => logSet(exercise.id, r, w))
    }
    clear()
  }

  /**
   * "Previous Set" loads the last logged set back into the keypad so a mistyped
   * number can be corrected, rather than discarding it.
   */
  function handlePreviousSet() {
    const last = exercise.sets[exercise.sets.length - 1]
    if (!last) return
    setEditingSetId(last.id)
    setReps(last.reps_done?.toString() ?? '')
    setWeight(last.weight?.toString() ?? '')
    setField('reps')
  }

  const nextSetNumber = exercise.sets.length + 1

  return (
    <>
      <section className="surface mt-3 rounded-2xl p-5">
        <p className="label-caps">
          Exercise {index} of {total}
        </p>
        <h2 className="mt-1.5 text-xl leading-snug font-bold tracking-tight text-primary">
          {exercise.exercise_name}
        </h2>
        {exercise.prescribed_reps && (
          <p className="mt-1 text-sm text-secondary">
            Prescribed: {exercise.prescribed_reps}
          </p>
        )}

        {exercise.sets.length > 0 && (
          <ul className="mt-3 space-y-1">
            {exercise.sets.map((set) => (
              <li
                key={set.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] tabular-nums ${
                  set.id === editingSetId
                    ? 'bg-card-raised text-primary'
                    : 'text-secondary'
                }`}
              >
                <span className="label-caps">Set {set.set_number}</span>
                <span className="ml-auto">
                  {set.reps_done ?? '—'} reps × {set.weight ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-3">
        <NumericEntry
          label={editingSetId ? 'Editing Set' : `Set ${nextSetNumber}`}
          reps={reps}
          weight={weight}
          active={field}
          onActivate={setField}
          onChange={(f, v) => (f === 'reps' ? setReps(v) : setWeight(v))}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <ActionButton tone="primary" onClick={handleDone}>
          {editingSetId ? 'Update Set' : 'Log Set'}
        </ActionButton>
        <ActionButton onClick={() => setShowComment((v) => !v)}>
          Comment
        </ActionButton>
      </div>

      {showComment && (
        <div className="surface mt-3 rounded-2xl p-4">
          <label className="block">
            <span className="label-caps">Notes for this exercise</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => onRun(() => saveComment(exercise.id, comment))}
              rows={3}
              placeholder="How did it feel?"
              className="mt-2 w-full rounded-xl border border-hairline bg-card-raised px-3 py-2.5 text-[15px] text-primary placeholder:text-faint"
            />
          </label>
          <ActionButton
            className="mt-2 w-full"
            onClick={() => onRun(() => saveComment(exercise.id, comment))}
          >
            Save Comment
          </ActionButton>
        </div>
      )}

      {/* Thumb-zone actions: the three decisions available on an exercise. */}
      <div className="mt-3">
        <TripleActionRow>
          <ActionButton
            onClick={handlePreviousSet}
            disabled={exercise.sets.length === 0}
          >
            Previous Set
          </ActionButton>
          <ActionButton
            tone="primary"
            onClick={() =>
              onRun(() => setExerciseStatus(exercise.id, 'completed'))
            }
          >
            Mark Complete
          </ActionButton>
          <ActionButton
            tone="danger"
            onClick={() =>
              onRun(() => setExerciseStatus(exercise.id, 'skipped'))
            }
          >
            Skip Exercise
          </ActionButton>
        </TripleActionRow>
      </div>
    </>
  )
}
