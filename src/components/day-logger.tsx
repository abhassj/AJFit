'use client'

import Link from 'next/link'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useState, useTransition } from 'react'

import {
  deleteSession,
  deleteSet,
  startBackfill,
} from '@/app/(app)/history/actions'
import {
  logSet,
  saveComment,
  setExerciseStatus,
  updateSet,
} from '@/app/(app)/start/actions'
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  RestIcon,
  SkipIcon,
  TrashIcon,
} from '@/components/icons'
import { FadeIn } from '@/components/motion'
import { NumericEntry, type NumericField } from '@/components/numeric-keypad'
import { ActionButton, Banner, TripleActionRow } from '@/components/ui'
import { formatLongDate } from '@/lib/home-types'
import { ProgramDayPicker } from '@/components/program-day-picker'
import { DAY_LABELS, type DayOfWeek, type Program } from '@/lib/program-types'
import {
  formatClockTime,
  formatDuration,
  type SessionExercise,
  type WorkoutSession,
} from '@/lib/session-types'

type Outcome = { ok: true } | { ok: false; error: string }

/**
 * The day view behind every calendar tap.
 *
 * One component covers three cases so the calendar has a single destination:
 *   - a day with a session  -> edit it (sets, comments, per-exercise status)
 *   - a past day with none  -> offer to write it up after the fact
 *   - a rest day with none  -> same, behind an explicit confirmation
 *
 * There is deliberately no timer here. A workout being recorded after the fact
 * has no real elapsed time, and the session row keeps start_time/end_time null.
 */
export function DayLogger({
  date,
  session,
  program,
  calendarDow,
  isFuture,
}: {
  date: string
  session: WorkoutSession | null
  program: Program
  calendarDow: DayOfWeek
  isFuture: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [confirmingRest, setConfirmingRest] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [selectedDow, setSelectedDow] = useState<DayOfWeek>(calendarDow)
  const [pending, startTransition] = useTransition()

  // Which program day this backfill will follow. Defaults to the date's own
  // weekday, but a missed session may well have been a different day's workout.
  const day =
    program.days.find((d) => d.day_of_week === selectedDow) ?? program.days[0]

  function run(fn: () => Promise<Outcome>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error)
    })
  }

  const header = (
    <header className="px-1 pt-4 pb-5">
      <p className="label-caps">
        {session
          ? session.status === 'skipped'
            ? 'Skipped'
            : 'Logged Workout'
          : isFuture
            ? 'Upcoming'
            : 'Not Logged'}
      </p>
      <h1 className="mt-1.5 text-[22px] leading-tight font-bold tracking-tight text-primary">
        {formatLongDate(date)}
      </h1>
      {session &&
        session.start_time === null &&
        session.status !== 'skipped' && (
          <p className="mt-1.5 text-[13px] text-faint">
            Added after the fact — no session timing recorded.
          </p>
        )}
    </header>
  )

  const back = (
    <Link
      href="/"
      className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Home
    </Link>
  )

  // ---- no session yet -----------------------------------------------------
  if (!session) {
    return (
      <main className="px-4 pt-2">
        {back}
        {header}

        {error && (
          <div className="mb-4">
            <Banner tone="error">{error}</Banner>
          </div>
        )}

        {isFuture ? (
          <p className="surface rounded-2xl px-5 py-8 text-center text-sm text-secondary">
            This day hasn’t happened yet.
          </p>
        ) : day.exercises.length === 0 ? (
          <p className="surface rounded-2xl px-5 py-8 text-center text-sm text-secondary">
            {day.is_rest_day
              ? 'This weekday is a rest day with no exercises in your program.'
              : 'This weekday has no exercises in your program yet.'}
          </p>
        ) : (
          <FadeIn>
            <section className="surface overflow-hidden rounded-2xl">
              <div className="px-5 pt-5 pb-3">
                <h2 className="label-caps">
                  {day.title?.trim() || 'From your program'}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
                  {day.exercises.length} exercise
                  {day.exercises.length === 1 ? '' : 's'} from{' '}
                  {DAY_LABELS[selectedDow]}’s program.
                </p>
              </div>
              <ul>
                {day.exercises.map((exercise, i) => (
                  <li
                    key={exercise.id}
                    className="flex items-center gap-3.5 border-t border-hairline/60 px-5 py-3"
                  >
                    <span className="w-5 shrink-0 text-[13px] font-semibold text-faint tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] text-primary">
                      {exercise.exercise_name}
                    </span>
                    {exercise.prescribed_reps && (
                      <span className="shrink-0 text-[13px] text-secondary">
                        {exercise.prescribed_reps}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <ProgramDayPicker
              program={program}
              selected={selectedDow}
              defaultDay={calendarDow}
              onSelect={(d) => {
                setSelectedDow(d)
                setConfirmingRest(false)
              }}
              disabled={pending}
            />

            <div className="mt-2 space-y-2.5">
              {day.is_rest_day && !confirmingRest ? (
                <>
                  <div className="surface flex items-start gap-3 rounded-xl px-4 py-3.5">
                    <RestIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
                    <p className="text-[13px] leading-relaxed text-secondary">
                      This is a rest day in your program — log a workout anyway?
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <ActionButton onClick={() => history.back()}>
                      Not now
                    </ActionButton>
                    <ActionButton
                      tone="danger"
                      onClick={() => setConfirmingRest(true)}
                    >
                      Log anyway
                    </ActionButton>
                  </div>
                </>
              ) : (
                <ActionButton
                  tone="danger"
                  className="w-full"
                  disabled={pending}
                  onClick={() => run(() => startBackfill(date, selectedDow))}
                >
                  {pending ? 'Creating…' : 'Log this workout'}
                </ActionButton>
              )}
            </div>
          </FadeIn>
        )}
      </main>
    )
  }

  // ---- explicit whole-day skip -------------------------------------------
  if (session.status === 'skipped') {
    return (
      <main className="px-4 pt-2">
        {back}
        {header}
        {error && (
          <div className="mb-4">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
        <p className="surface rounded-2xl px-5 py-8 text-center text-sm text-secondary">
          This day was explicitly marked as skipped. No sets were logged.
        </p>
        <DeleteDay
          confirming={confirmingDelete}
          setConfirming={setConfirmingDelete}
          pending={pending}
          onDelete={() => run(() => deleteSession(session.id, date))}
        />
      </main>
    )
  }

  // ---- editable session ---------------------------------------------------
  return (
    <main className="px-4 pt-2">
      {back}
      {header}

      {error && (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      <SessionTiming session={session} />

      <SwipeableExercises
        exercises={session.exercises}
        date={date}
        onRun={run}
      />

      <DeleteDay
        confirming={confirmingDelete}
        setConfirming={setConfirmingDelete}
        pending={pending}
        onDelete={() => run(() => deleteSession(session.id, date))}
      />
    </main>
  )
}

/**
 * Session totals and timing.
 *
 * A backfilled day has no start_time, so the clock rows are omitted rather than
 * shown as blanks — but the totals still apply either way.
 */
function SessionTiming({ session }: { session: WorkoutSession }) {
  const timed = session.start_time !== null
  const workingSeconds =
    session.start_time && session.end_time
      ? Math.max(
          0,
          Math.floor(
            (new Date(session.end_time).getTime() -
              new Date(session.start_time).getTime()) /
              1000,
          ) - session.paused_seconds,
        )
      : 0

  const completed = session.exercises.filter((e) => e.status === 'completed')
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)

  return (
    <section className="surface mb-3 rounded-2xl p-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat
          label="Duration"
          value={workingSeconds > 0 ? formatDuration(workingSeconds) : '—'}
        />
        <Stat label="Exercises" value={`${completed.length}`} />
        <Stat label="Sets" value={`${totalSets}`} />
      </div>

      {timed && (
        <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-[13px]">
          <TimingRow
            label="Started"
            value={formatClockTime(session.start_time)}
          />
          <TimingRow
            label="Finished"
            value={
              session.end_time
                ? formatClockTime(session.end_time)
                : 'Not finished'
            }
          />
          <TimingRow
            label="Paused"
            value={
              session.paused_seconds > 0
                ? formatDuration(session.paused_seconds)
                : 'None'
            }
          />
        </dl>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-primary tabular-nums">
        {value}
      </p>
    </div>
  )
}

function TimingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-secondary tabular-nums">{value}</dd>
    </div>
  )
}

function DeleteDay({
  confirming,
  setConfirming,
  pending,
  onDelete,
}: {
  confirming: boolean
  setConfirming: (v: boolean) => void
  pending: boolean
  onDelete: () => void
}) {
  return (
    <div className="mt-5">
      {confirming ? (
        <div className="space-y-2.5">
          <p className="surface rounded-xl px-4 py-3 text-center text-[13px] text-secondary">
            Delete this day’s log entirely? Sets and comments go with it.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <ActionButton onClick={() => setConfirming(false)}>
              Keep it
            </ActionButton>
            <ActionButton tone="danger" disabled={pending} onClick={onDelete}>
              Delete
            </ActionButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full py-3 text-center text-[13px] font-semibold text-faint transition-colors hover:text-danger"
        >
          Delete this day’s log
        </button>
      )}
    </div>
  )
}

/**
 * One exercise at a time, with a horizontal swipe to move between them.
 *
 * The drag animates `x` only — a transform, so it stays on the compositor.
 */
function SwipeableExercises({
  exercises,
  date,
  onRun,
}: {
  exercises: SessionExercise[]
  date: string
  onRun: (fn: () => Promise<Outcome>) => void
}) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const reduced = useReducedMotion()

  const clamped = Math.min(index, exercises.length - 1)
  const exercise = exercises[clamped]
  if (!exercise) return null

  function go(delta: number) {
    const next = clamped + delta
    if (next < 0 || next >= exercises.length) return
    setDirection(delta)
    setIndex(next)
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <h2 className="label-caps">
          Exercise {clamped + 1} of {exercises.length}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={clamped === 0}
            aria-label="Previous exercise"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary disabled:opacity-30"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={clamped === exercises.length - 1}
            aria-label="Next exercise"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary disabled:opacity-30"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress pips double as a hint that this pane is swipeable. */}
      <div className="flex gap-1.5 px-1 pb-3">
        {exercises.map((e, i) => (
          <span
            key={e.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i === clamped
                ? 'bg-primary'
                : e.status === 'completed'
                  ? 'bg-success/60'
                  : e.status === 'skipped'
                    ? 'bg-danger/50'
                    : 'bg-hairline'
            }`}
          />
        ))}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <m.div
            key={exercise.id}
            custom={direction}
            initial={
              reduced ? false : { opacity: 0, x: direction > 0 ? 60 : -60 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduced ? undefined : { opacity: 0, x: direction > 0 ? -60 : 60 }
            }
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            drag={reduced ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1)
              else if (info.offset.x > 60) go(-1)
            }}
          >
            <EditableExercise
              exercise={exercise}
              date={date}
              onRun={onRun}
              onAdvance={() => go(1)}
            />
          </m.div>
        </AnimatePresence>
      </div>

      <p className="px-1 pt-3 text-center text-[12px] text-faint">
        Swipe left or right to move between exercises.
      </p>
    </section>
  )
}

function EditableExercise({
  exercise,
  date,
  onRun,
  onAdvance,
}: {
  exercise: SessionExercise
  date: string
  onRun: (fn: () => Promise<Outcome>) => void
  onAdvance: () => void
}) {
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [field, setField] = useState<NumericField>('reps')
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [comment, setComment] = useState(exercise.comment ?? '')

  const toNumber = (v: string) => {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  function clear() {
    setReps('')
    setWeight('')
    setField('reps')
    setEditingSetId(null)
  }

  function submitSet() {
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

  return (
    <div className="space-y-3">
      <section className="surface rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl leading-snug font-bold tracking-tight text-primary">
              {exercise.exercise_name}
            </h3>
            {exercise.prescribed_reps && (
              <p className="mt-1 text-sm text-secondary">
                Prescribed: {exercise.prescribed_reps}
              </p>
            )}
          </div>
          <StatusPill status={exercise.status} at={exercise.completed_at} />
        </div>

        {exercise.sets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {exercise.sets.map((set) => (
              <li
                key={set.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] tabular-nums ${
                  set.id === editingSetId
                    ? 'bg-card-raised text-primary'
                    : 'bg-card-raised/40 text-secondary'
                }`}
              >
                <span className="label-caps">Set {set.set_number}</span>
                <span className="ml-auto">
                  {set.reps_done ?? '—'} × {set.weight ?? '—'}
                </span>
                <button
                  type="button"
                  aria-label={`Edit set ${set.set_number}`}
                  onClick={() => {
                    setEditingSetId(set.id)
                    setReps(set.reps_done?.toString() ?? '')
                    setWeight(set.weight?.toString() ?? '')
                    setField('reps')
                  }}
                  className="ml-1 text-[12px] font-semibold text-secondary hover:text-primary"
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete set ${set.set_number}`}
                  onClick={() => onRun(() => deleteSet(set.id, date))}
                  className="text-faint hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <NumericEntry
        label={editingSetId ? 'Editing Set' : `Set ${exercise.sets.length + 1}`}
        reps={reps}
        weight={weight}
        active={field}
        onActivate={setField}
        onChange={(f, v) => (f === 'reps' ? setReps(v) : setWeight(v))}
      />

      <ActionButton tone="primary" className="w-full" onClick={submitSet}>
        {editingSetId ? 'Update Set' : 'Add Set'}
      </ActionButton>

      <div className="surface rounded-2xl p-4">
        <label className="block">
          <span className="label-caps">Notes for this exercise</span>
          <textarea
            value={comment}
            rows={2}
            placeholder="How did it feel?"
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onRun(() => saveComment(exercise.id, comment))}
            className="mt-2 w-full rounded-xl border border-hairline bg-card-raised px-3 py-2.5 text-[15px] text-primary placeholder:text-faint"
          />
        </label>
      </div>

      <TripleActionRow>
        <ActionButton
          onClick={() => onRun(() => setExerciseStatus(exercise.id, 'pending'))}
        >
          Clear
        </ActionButton>
        <ActionButton
          tone="primary"
          onClick={() => {
            onRun(() => setExerciseStatus(exercise.id, 'completed'))
            onAdvance()
          }}
        >
          Complete
        </ActionButton>
        <ActionButton
          tone="danger"
          onClick={() => {
            onRun(() => setExerciseStatus(exercise.id, 'skipped'))
            onAdvance()
          }}
        >
          Skip
        </ActionButton>
      </TripleActionRow>
    </div>
  )
}

function StatusPill({
  status,
  at,
}: {
  status: SessionExercise['status']
  at: string | null
}) {
  if (status === 'completed') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
        <CheckIcon className="h-3.5 w-3.5" />
        {at ? formatClockTime(at) : 'Done'}
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">
        <SkipIcon className="h-3.5 w-3.5" />
        Skipped
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-faint">
      Pending
    </span>
  )
}
