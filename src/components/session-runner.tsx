'use client'

import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { unstable_isUnrecognizedActionError } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { finishSession, markSessionSkipped } from '@/app/(app)/start/actions'
import {
  CheckIcon,
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
} from '@/components/icons'
import { NumericEntry, type NumericField } from '@/components/numeric-keypad'
import { NewPrBadge, PrPill } from '@/components/pr-pill'
import { RestTimer } from '@/components/rest-timer'
import { ActionButton, Banner, TripleActionRow } from '@/components/ui'
import { useUnits } from '@/components/units-provider'
import { newId } from '@/lib/id'
import { isNewRecord, type PersonalRecord } from '@/lib/pr-types'
import {
  elapsedSeconds,
  formatClockTime,
  formatDuration,
  prescribedSetCount,
  type SessionExercise,
  type SessionExerciseStatus,
  type WorkoutSession,
} from '@/lib/session-types'
import {
  applyWrite,
  describeWrite,
  runWrite,
  type SessionWrite,
} from '@/lib/session-writes'
import { displayWeight, toKg, type WeightUnit } from '@/lib/units'
import { useActiveRest } from '@/lib/use-active-rest'
import { useNow } from '@/lib/use-now'
import { useWriteQueue, type SaveState } from '@/lib/use-write-queue'
import { validateSetEntry } from '@/lib/validation'

/*
 * ============================================================================
 * Client state is the source of truth while a session is on screen.
 * ============================================================================
 * Every tap becomes a SessionWrite (src/lib/session-writes.ts) that is applied
 * to `exercises` here first, so the screen answers at once, and then queued
 * for the server (src/lib/use-write-queue.ts), which saves in the background,
 * in order. Nothing in the tap path waits on the network or re-renders the
 * page from the server — that round trip is what made logging feel slow.
 *
 * The server's copy (the `session` prop) seeds this state once. It is not
 * re-read mid-session, so a background re-render of the page can never snap
 * the screen back to an older version of what the user just did. Writes left
 * unsaved by a previous load of this page (a stale deploy's reload, or an
 * accidental one) are replayed over it on mount.
 */

type Handlers = {
  logSet: (
    exerciseId: string,
    reps: number | null,
    weightKg: number | null,
  ) => void
  updateSet: (
    exerciseId: string,
    setId: string,
    reps: number | null,
    weightKg: number | null,
  ) => void
  setStatus: (exerciseId: string, status: SessionExerciseStatus) => void
  saveComment: (exerciseId: string, comment: string) => void
}

export function SessionRunner({
  session,
  dayTitle,
  records,
}: {
  session: WorkoutSession
  dayTitle: string
  /** Personal records by exercise name, excluding this session. */
  records: Record<string, PersonalRecord>
}) {
  const [exercises, setExercises] = useState<SessionExercise[]>(
    session.exercises,
  )
  /*
   * The latest exercises, for handlers that may be called from a stale render.
   * When an exercise is completed its panel animates out for ~220ms, and its
   * buttons are still under the thumb during that exit: a quick second tap on
   * "Skip Exercise" would otherwise land on the exercise that was just
   * completed. Handlers check the live status here and ignore those taps.
   *
   * Every change goes through commit(), which updates this ref and the state
   * together, so the two never disagree.
   */
  const latest = useRef(session.exercises)
  const isPending = (id: string) =>
    latest.current.find((e) => e.id === id)?.status === 'pending'
  const [pausedSeconds, setPausedSeconds] = useState(session.paused_seconds)
  const [pausedSince, setPausedSince] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(
    session.exercises.find((e) => e.status === 'pending')?.id ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [confirmEmptyFinish, setConfirmEmptyFinish] = useState(false)
  const [, startTransition] = useTransition()
  const queue = useWriteQueue<SessionWrite>({
    storageKey: `ajfit-pending-writes:${session.id}`,
    run: (write) => runWrite(session.id, write),
    label: describeWrite,
  })

  const reduced = useReducedMotion()

  // Ticks once a second; 0 until mounted, so SSR and first paint agree.
  const now = useNow()

  const seconds = useMemo(
    () =>
      now === 0
        ? 0
        : elapsedSeconds(session.start_time, pausedSeconds, pausedSince, now),
    [session.start_time, pausedSeconds, pausedSince, now],
  )

  /*
   * The panel follows the selected exercise only while it is still pending.
   * Once it is completed or skipped it drops out and the next pending one takes
   * over, so logging never silently keeps writing to an exercise the user has
   * already closed out.
   */
  const active =
    exercises.find((e) => e.id === activeId && e.status === 'pending') ??
    exercises.find((e) => e.status === 'pending') ??
    null
  // "Up Next" is everything still pending other than the one on screen.
  const remaining = exercises.filter(
    (e) => e.status === 'pending' && e.id !== active?.id,
  )
  const logged = exercises.filter((e) => e.status !== 'pending')

  /** Applies writes to the screen and queues them for the server. */
  function commit(...writes: SessionWrite[]) {
    let next = latest.current
    let pausedTotal: number | null = null
    for (const write of writes) {
      next = applyWrite(next, write)
      if (write.kind === 'pause') pausedTotal = write.totalSeconds
    }
    latest.current = next
    setExercises(next)
    // Totals only grow; a replayed one the server already had changes nothing.
    if (pausedTotal !== null) {
      const total = pausedTotal
      setPausedSeconds((s) => Math.max(s, total))
    }
    queue.enqueue(...writes)
  }

  /*
   * Replay what an earlier load of this page left unsaved, oldest first and
   * before anything new can be tapped. The writes go back through commit(),
   * so they reach the screen and the queue exactly as they did originally.
   */
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const pending = queue.restore()
    if (pending.length > 0) commit(...pending)
    // Runs once on mount; commit and queue are stable for that purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlers: Handlers = {
    logSet(exerciseId, reps, weightKg) {
      const exercise = latest.current.find((e) => e.id === exerciseId)
      if (!exercise || exercise.status !== 'pending') return
      commit({
        kind: 'logSet',
        setId: newId(),
        exerciseId,
        setNumber: Math.max(0, ...exercise.sets.map((s) => s.set_number)) + 1,
        reps,
        weight: weightKg,
      })
    },
    updateSet(exerciseId, setId, reps, weightKg) {
      commit({ kind: 'updateSet', setId, exerciseId, reps, weight: weightKg })
    },
    setStatus(exerciseId, status) {
      if (!isPending(exerciseId)) return
      commit({
        kind: 'status',
        exerciseId,
        status,
        completedAt: status === 'pending' ? null : new Date().toISOString(),
      })
    },
    saveComment(exerciseId, comment) {
      const exercise = latest.current.find((e) => e.id === exerciseId)
      if (!exercise || exercise.comment === (comment.trim() || null)) return
      commit({ kind: 'comment', exerciseId, comment })
    },
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
    commit({ kind: 'pause', totalSeconds: pausedSeconds + elapsed })
  }

  /**
   * Runs a session-ending action once every queued write has landed — or the
   * summary would be rendered from a log that is still missing sets.
   */
  async function close(
    action: (pausedTotal: number) => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (finishing) return
    // The whole paused time, including a pause still running: absolute, so a
    // retried Finish cannot add the trailing pause twice.
    const trailing = pausedSince
      ? Math.floor((Date.now() - new Date(pausedSince).getTime()) / 1000)
      : 0
    const pausedTotal = pausedSeconds + trailing
    setError(null)
    setConfirmEmptyFinish(false)
    setFinishing(true)

    const saved = await queue.flush()
    if (!saved) {
      setFinishing(false)
      setError('Some changes have not saved yet. Retry them, then finish.')
      return
    }

    setPausedSince(null)
    startTransition(async () => {
      try {
        const result = await action(pausedTotal)
        if (!result.ok) {
          setError(result.error ?? 'Could not finish the session.')
          setFinishing(false)
        }
      } catch (e) {
        // A deploy landed: this page's actions no longer exist. Nothing is
        // queued at this point, so reloading onto the new build loses nothing;
        // the session is still open there and Finish works again.
        if (unstable_isUnrecognizedActionError(e)) {
          window.location.reload()
          return
        }
        setError(
          'Could not reach the server. Check your connection and try again.',
        )
        setFinishing(false)
      }
    })
  }

  function handleFinish() {
    /*
     * Finishing with nothing completed would paint the day green on Home with
     * no work behind it (decision D8), so ask what actually happened first.
     */
    if (!latest.current.some((e) => e.status === 'completed')) {
      setConfirmEmptyFinish(true)
      return
    }
    void close((pausedTotal) => finishSession(session.id, pausedTotal))
  }

  return (
    <main className="px-4 pt-2 pb-4">
      <header className="flex items-start gap-3 px-1 pb-5">
        <div className="min-w-0 flex-1">
          <p className="label-caps">Logging Session</p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
            {dayTitle}
          </h1>
        </div>
        <SaveIndicator state={queue.state} />
      </header>

      {queue.state.status === 'failed' && (
        <SaveFailed state={queue.state} onRetry={queue.retry} />
      )}

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
            <ActionButton
              onClick={handlePause}
              disabled={!!pausedSince || finishing}
            >
              <PauseIcon className="h-5 w-5" />
              Pause
            </ActionButton>
            <ActionButton
              onClick={handleResume}
              disabled={!pausedSince || finishing}
            >
              <PlayIcon className="h-5 w-5" />
              Resume
            </ActionButton>
            <ActionButton
              tone="danger"
              onClick={handleFinish}
              disabled={finishing}
            >
              <CheckIcon className="h-5 w-5" />
              {finishing ? 'Finishing…' : 'Finish'}
            </ActionButton>
          </TripleActionRow>
        </div>

        {confirmEmptyFinish && (
          <div
            role="alertdialog"
            aria-label="No exercises completed"
            className="mt-4 rounded-xl border border-hairline bg-card-raised p-4"
          >
            <p className="text-[15px] font-semibold text-primary">
              No exercises completed.
            </p>
            <p className="mt-1 text-sm text-secondary">
              Finish anyway, or mark the day skipped?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <ActionButton
                onClick={() =>
                  void close((pausedTotal) =>
                    finishSession(session.id, pausedTotal),
                  )
                }
              >
                Finish Anyway
              </ActionButton>
              <ActionButton
                tone="danger"
                onClick={() => void close(() => markSessionSkipped(session.id))}
              >
                Mark Skipped
              </ActionButton>
            </div>
            <button
              type="button"
              onClick={() => setConfirmEmptyFinish(false)}
              className="mt-2 w-full py-2 text-[13px] font-semibold text-faint"
            >
              Keep logging
            </button>
          </div>
        )}
      </section>

      {active ? (
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {/*
             * Swiping moves to the next or previous pending exercise. Only `x`
             * is animated — a transform, so the gesture stays on the compositor
             * and never triggers layout.
             */}
            <m.div
              key={active.id}
              initial={reduced ? false : { opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -50 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              drag={reduced ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                const pending = exercises.filter((e) => e.status === 'pending')
                const at = pending.findIndex((e) => e.id === active.id)
                if (info.offset.x < -60 && at < pending.length - 1) {
                  setActiveId(pending[at + 1].id)
                } else if (info.offset.x > 60 && at > 0) {
                  setActiveId(pending[at - 1].id)
                }
              }}
            >
              <ExercisePanel
                exercise={active}
                index={exercises.findIndex((e) => e.id === active.id) + 1}
                total={exercises.length}
                handlers={handlers}
                disabled={finishing}
                record={records[active.exercise_name]}
              />
            </m.div>
          </AnimatePresence>
          {remaining.length > 0 && (
            <p className="px-1 pt-3 text-center text-[12px] text-faint">
              Swipe left or right to move between exercises.
            </p>
          )}
        </div>
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

/**
 * Quiet while everything is saved; "Saving…" while the queue drains. Failures
 * get the pinned alert below instead, because they need a tap.
 */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state.status !== 'saving') return null
  return (
    <p
      role="status"
      className="label-caps mt-1 shrink-0 animate-pulse text-faint"
    >
      Saving…
    </p>
  )
}

function SaveFailed({
  state,
  onRetry,
}: {
  state: Extract<SaveState, { status: 'failed' }>
  onRetry: () => void
}) {
  /*
   * Pinned just above the bottom navigation rather than placed in the page
   * flow: mid-set the page is scrolled down to the keypad, and an alert at the
   * top of the page would be off screen — a failure nobody sees is a silent
   * one. Opaque, so it stays legible over whatever scrolls beneath it.
   */
  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-xl border border-danger/50 bg-card px-4 py-3 shadow-2xl"
    >
      <p className="min-w-0 flex-1 text-sm leading-snug text-danger">
        {state.label} didn’t save
        {state.pending > 1 ? ` (${state.pending} changes waiting)` : ''}.{' '}
        <span className="text-secondary">{state.error}</span>
      </p>
      <ActionButton tone="danger" onClick={onRetry} className="shrink-0">
        Retry
      </ActionButton>
    </div>
  )
}

function formatSet(
  set: { reps_done: number | null; weight: number | null },
  unit: WeightUnit,
) {
  const weight = set.weight == null ? '—' : displayWeight(set.weight, unit)
  return `${set.reps_done ?? '—'}×${weight}`
}

/** The design doc's completed-item log: checkmark, name, timestamp. */
function SessionLog({ exercises }: { exercises: SessionExercise[] }) {
  const { weight: unit } = useUnits()
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
                        .map((s) => formatSet(s, unit))
                        .join('  ·  ')}{' '}
                      {unit}
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
  handlers,
  disabled,
  record,
}: {
  exercise: SessionExercise
  index: number
  total: number
  handlers: Handlers
  disabled: boolean
  /** The record coming into this session; undefined when there is none. */
  record: PersonalRecord | undefined
}) {
  const { weight: unit } = useUnits()
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [field, setField] = useState<NumericField>('reps')
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [entryError, setEntryError] = useState<string | null>(null)
  const [comment, setComment] = useState(exercise.comment ?? '')
  const [showComment, setShowComment] = useState(!!exercise.comment)

  /*
   * Rest starts by itself the moment a NEW set is logged, when the template
   * defines a rest period (rest_seconds > 0; null or 0 means no timer). It
   * opens on the tap, before the save — the save runs in the background and a
   * failure still shows its Retry alert once the timer is closed.
   *
   * Only a fresh log on this screen starts it. Correcting a set, a replay
   * after a reload or a Retry never comes through handleDone, and the history
   * editor has no timer at all.
   *
   * The rest lives in sessionStorage (useActiveRest), so a reload mid-rest —
   * BuildCheck after a deploy, typically — brings it back with the right time
   * remaining.
   */
  const canRest = (exercise.rest_seconds ?? 0) > 0
  const [rest, setRest] = useActiveRest(exercise.id)
  const restStartedAt = rest?.startedAt ?? null

  function clear() {
    setReps('')
    setWeight('')
    setField('reps')
    setEditingSetId(null)
    setEntryError(null)
  }

  function handleDone() {
    // The shared validator rejects blank-and-blank and stray zeros, and the
    // failure is shown rather than swallowed.
    const { reps: r, weight: w, error } = validateSetEntry(reps, weight)
    if (error) {
      setEntryError(error)
      return
    }
    setEntryError(null)

    // Typed in the user's unit, stored in kilograms (src/lib/units.ts).
    const kg = w == null ? null : toKg(w, unit)

    if (editingSetId) {
      handlers.updateSet(exercise.id, editingSetId, r, kg)
    } else {
      const newRecord = isNewRecord(
        { weight: kg, reps_done: r },
        exercise.sets,
        record,
      )
      handlers.logSet(exercise.id, r, kg)
      // Only a freshly logged set earns a rest period; correcting an old one
      // is bookkeeping, not work. Logging again while resting restarts it.
      if (canRest) setRest({ startedAt: Date.now(), newRecord })
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
    setWeight(last.weight == null ? '' : displayWeight(last.weight, unit))
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
        {(exercise.prescribed_reps || canRest) && (
          <p className="mt-1 text-sm text-secondary">
            {exercise.prescribed_reps &&
              `Prescribed: ${exercise.prescribed_reps}`}
            {exercise.prescribed_reps && canRest && ' · '}
            {canRest && `${exercise.rest_seconds}s rest`}
          </p>
        )}
        <div className="mt-2">
          <PrPill record={record} unit={unit} testId="exercise-pr" />
        </div>

        {exercise.sets.length > 0 && (
          <ul className="mt-3 space-y-1">
            {exercise.sets.map((set, i) => (
              <li
                key={set.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] tabular-nums ${
                  set.id === editingSetId
                    ? 'bg-card-raised text-primary'
                    : 'text-secondary'
                }`}
              >
                <span className="label-caps">Set {set.set_number}</span>
                {isNewRecord(set, exercise.sets.slice(0, i), record) && (
                  <NewPrBadge />
                )}
                <span className="ml-auto">
                  {set.reps_done ?? '—'} reps ×{' '}
                  {set.weight == null
                    ? '—'
                    : `${displayWeight(set.weight, unit)} ${unit}`}
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
          weightUnit={unit}
          active={field}
          onActivate={setField}
          error={entryError}
          onChange={(f, v) => {
            // Clear the message as soon as they start correcting it.
            setEntryError(null)
            if (f === 'reps') setReps(v)
            else setWeight(v)
          }}
        />
      </div>

      <AnimatePresence>
        {restStartedAt !== null && (
          <RestTimer
            key={restStartedAt}
            startedAt={restStartedAt}
            seconds={exercise.rest_seconds ?? 0}
            exerciseName={exercise.exercise_name}
            nextSet={exercise.sets.length + 1}
            totalSets={prescribedSetCount(exercise.prescribed_reps)}
            newRecord={rest?.newRecord ?? false}
            // One button whatever the countdown says: close rest and put the
            // keypad straight back on reps.
            onDone={() => {
              setRest(null)
              setField('reps')
            }}
          />
        )}
      </AnimatePresence>

      {restStartedAt === null && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <ActionButton
              tone="primary"
              onClick={handleDone}
              disabled={disabled}
            >
              {editingSetId ? 'Update Set' : 'Log Set'}
            </ActionButton>
            <ActionButton onClick={() => setShowComment((v) => !v)}>
              Comment
            </ActionButton>
          </div>
        </>
      )}

      {showComment && (
        <div className="surface mt-3 rounded-2xl p-4">
          <label className="block">
            <span className="label-caps">Notes for this exercise</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => handlers.saveComment(exercise.id, comment)}
              rows={3}
              placeholder="How did it feel?"
              className="mt-2 w-full rounded-xl border border-hairline bg-card-raised px-3 py-2.5 text-[15px] text-primary placeholder:text-faint"
            />
          </label>
          <ActionButton
            className="mt-2 w-full"
            onClick={() => handlers.saveComment(exercise.id, comment)}
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
            disabled={exercise.sets.length === 0 || disabled}
          >
            Previous Set
          </ActionButton>
          <ActionButton
            tone="primary"
            disabled={disabled}
            onClick={() => {
              // A comment typed but never blurred still belongs to this
              // exercise; save it before the panel moves on.
              handlers.saveComment(exercise.id, comment)
              handlers.setStatus(exercise.id, 'completed')
            }}
          >
            Mark Complete
          </ActionButton>
          <ActionButton
            tone="danger"
            disabled={disabled}
            onClick={() => {
              handlers.saveComment(exercise.id, comment)
              handlers.setStatus(exercise.id, 'skipped')
            }}
          >
            Skip Exercise
          </ActionButton>
        </TripleActionRow>
      </div>
    </>
  )
}
