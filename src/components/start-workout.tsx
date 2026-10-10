'use client'

import { useState, useTransition } from 'react'

import { skipDay, startSession } from '@/app/(app)/start/actions'
import { CheckIcon, PlayIcon, RestIcon, SkipIcon } from '@/components/icons'
import { ActionButton, Banner } from '@/components/ui'
import { ProgramDayPicker } from '@/components/program-day-picker'
import { DAY_LABELS, type DayOfWeek, type Program } from '@/lib/program-types'
import { useUnits } from '@/components/units-provider'
import { formatClockTime, formatDuration } from '@/lib/session-types'
import { displayWeight } from '@/lib/units'
import type { WorkoutSession } from '@/lib/session-types'

/** Pre-session screen: confirm and start, or explicitly skip the whole day. */
export function StartWorkout({
  program,
  todayDow,
  dayLabel,
}: {
  program: Program
  todayDow: DayOfWeek
  dayLabel: string
}) {
  const [confirming, setConfirming] = useState(false)
  /*
   * Only an explicit choice is held in state. Copying todayDow into state was
   * the bug: on a first visit the server renders with UTC, TimezoneSync then
   * refreshes with the real zone, and the new todayDow prop never reached a
   * useState that had already been initialised — so the heading and the
   * session started from it stayed on UTC's weekday.
   */
  const [chosenDow, setChosenDow] = useState<DayOfWeek | null>(null)
  const selectedDow = chosenDow ?? todayDow
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const day =
    program.days.find((d) => d.day_of_week === selectedDow) ?? program.days[0]
  const runningToday = selectedDow === todayDow

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.error)
    })
  }

  // A rest day is only a dead end while it is the one selected; the picker
  // below still lets another day be chosen.
  if (day.is_rest_day && runningToday) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="surface flex h-16 w-16 items-center justify-center rounded-2xl">
          <RestIcon className="h-7 w-7 text-faint" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Rest Day
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-secondary">
            {dayLabel} is marked as rest in your program. Nothing to log today.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ProgramDayPicker
            program={program}
            selected={selectedDow}
            defaultDay={todayDow}
            onSelect={setChosenDow}
            disabled={pending}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 pt-2">
      <header className="px-1 pb-5">
        <p className="label-caps">{dayLabel}</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          {day.title?.trim() || 'Today’s Workout'}
        </h1>
        <p className="mt-1.5 text-sm text-secondary">
          {day.exercises.length} exercise
          {day.exercises.length === 1 ? '' : 's'}
          {runningToday
            ? ' scheduled'
            : ` from ${DAY_LABELS[selectedDow]}’s program`}
        </p>
      </header>

      {error && (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      {day.exercises.length === 0 ? (
        <p className="surface rounded-2xl px-5 py-6 text-center text-sm text-secondary">
          Nothing scheduled for {DAY_LABELS[selectedDow]}. Add exercises in My
          Workout Split first.
        </p>
      ) : (
        <div className="surface overflow-hidden rounded-2xl">
          <ul>
            {day.exercises.map((exercise, i) => (
              <li
                key={exercise.id}
                className="flex items-center gap-3.5 border-t border-hairline/60 px-5 py-3.5 first:border-t-0"
              >
                <span className="w-5 shrink-0 text-[13px] font-semibold text-faint tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-primary">
                    {exercise.exercise_name}
                  </span>
                  {exercise.prescribed_reps && (
                    <span className="mt-0.5 block text-[13px] text-secondary">
                      {exercise.prescribed_reps}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProgramDayPicker
        program={program}
        selected={selectedDow}
        defaultDay={todayDow}
        onSelect={setChosenDow}
        disabled={pending}
      />

      {/* Primary actions sit at the bottom, in the thumb zone. */}
      <div className="sticky bottom-4 mt-2 space-y-2.5">
        {confirming ? (
          <>
            <p className="surface rounded-xl px-4 py-3 text-center text-sm text-secondary">
              Start logging {DAY_LABELS[selectedDow]}’s workout now?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <ActionButton onClick={() => setConfirming(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                tone="danger"
                disabled={pending}
                onClick={() => run(() => startSession(day.id))}
              >
                {pending ? 'Starting…' : 'Confirm Start'}
              </ActionButton>
            </div>
          </>
        ) : (
          <>
            <ActionButton
              tone="danger"
              className="w-full"
              disabled={pending || day.exercises.length === 0}
              onClick={() => setConfirming(true)}
            >
              <span className="flex items-center gap-2">
                <PlayIcon className="h-5 w-5" />
                Start Workout
              </span>
            </ActionButton>
            <ActionButton
              className="w-full"
              disabled={pending}
              onClick={() => run(skipDay)}
            >
              <span className="flex items-center gap-2">
                <SkipIcon className="h-4 w-4" />
                Skip Today
              </span>
            </ActionButton>
          </>
        )}
      </div>
    </main>
  )
}

/** Post-session summary, shown once a day has been completed or skipped. */
export function SessionSummary({
  session,
  heading,
}: {
  session: WorkoutSession
  /** The title of the day this session followed. */
  heading: string
}) {
  const { weight: unit } = useUnits()
  const skipped = session.status === 'skipped'
  const durationSeconds =
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
  const skippedExercises = session.exercises.filter(
    (e) => e.status === 'skipped',
  )
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)

  return (
    <main className="px-4 pt-2">
      <header className="px-1 pb-5 text-center">
        <div className="surface mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          {skipped ? (
            <SkipIcon className="h-6 w-6 text-faint" />
          ) : (
            <CheckIcon className="h-6 w-6 text-success" />
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-primary">
          {skipped ? 'Day Skipped' : 'Workout Complete'}
        </h1>
        <p className="mt-1.5 text-sm text-secondary">
          {heading} · {session.session_date}
        </p>
      </header>

      {!skipped && (
        <section className="surface rounded-2xl p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Duration" value={formatDuration(durationSeconds)} />
            <Stat label="Exercises" value={`${completed.length}`} />
            <Stat label="Sets" value={`${totalSets}`} />
          </div>
          {session.paused_seconds > 0 && (
            <p className="mt-3 text-center text-[13px] text-faint">
              Paused for {formatDuration(session.paused_seconds)}
            </p>
          )}
        </section>
      )}

      {skipped && (
        <p className="surface rounded-2xl px-5 py-6 text-center text-sm text-secondary">
          You marked today as skipped. No sets were logged.
        </p>
      )}

      {session.exercises.length > 0 && (
        <section className="mt-3">
          <h2 className="label-caps px-1 pb-2">Session Log</h2>
          <div className="surface overflow-hidden rounded-2xl">
            <ul>
              {session.exercises.map((exercise) => {
                const wasSkipped = exercise.status === 'skipped'
                return (
                  <li
                    key={exercise.id}
                    className="flex items-start gap-3 border-t border-hairline/60 px-5 py-3.5 first:border-t-0"
                  >
                    {wasSkipped ? (
                      <SkipIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
                    ) : exercise.status === 'completed' ? (
                      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-primary">
                        {exercise.exercise_name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-secondary">
                        {exercise.status === 'pending'
                          ? 'Not logged'
                          : `${wasSkipped ? 'Skipped' : 'Completed'} at ${formatClockTime(exercise.completed_at)}`}
                        {exercise.sets.length > 0 &&
                          ` · ${exercise.sets.length} set${exercise.sets.length === 1 ? '' : 's'}`}
                      </p>
                      {exercise.sets.length > 0 && (
                        <p className="mt-1 text-[13px] text-faint tabular-nums">
                          {exercise.sets
                            .map(
                              (s) =>
                                `${s.reps_done ?? '—'}×${s.weight == null ? '—' : displayWeight(s.weight, unit)}`,
                            )
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
      )}

      <p className="mt-4 px-1 text-center text-[13px] text-faint">
        {skippedExercises.length > 0 &&
          `${skippedExercises.length} exercise${skippedExercises.length === 1 ? '' : 's'} skipped. `}
        Come back tomorrow for the next session.
      </p>
    </main>
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
