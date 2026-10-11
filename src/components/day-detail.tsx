import Link from 'next/link'

import { ArrowLeftIcon, CheckIcon, SkipIcon } from '@/components/icons'
import { formatLongDate } from '@/lib/home-types'
import {
  formatClockTime,
  formatDuration,
  sessionHeading,
  type WorkoutSession,
} from '@/lib/session-types'
import { displayWeight, type WeightUnit } from '@/lib/units'

const STATUS_LABEL: Record<WorkoutSession['status'], string> = {
  completed: 'Completed',
  skipped: 'Skipped',
  in_progress: 'In progress',
}

/**
 * A logged day, read-only (V2 Phase 3.2).
 *
 * Tapping a day on Home used to open straight into the editor, so looking at
 * last Tuesday meant scrolling a keypad and a swipe deck. This shows what was
 * done at a glance; "Edit logged workout" at the bottom opens the editor, and
 * the editor's "Done editing" comes back here.
 *
 * A Server Component: there is nothing to interact with but two links.
 */
export function DayDetail({
  date,
  session,
  unit,
  isToday,
}: {
  date: string
  session: WorkoutSession
  unit: WeightUnit
  isToday: boolean
}) {
  const total = session.exercises.length
  const done = session.exercises.filter((e) => e.status === 'completed').length
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const duration =
    session.start_time && session.end_time
      ? Math.max(
          0,
          Math.floor(
            (new Date(session.end_time).getTime() -
              new Date(session.start_time).getTime()) /
              1000,
          ) - session.paused_seconds,
        )
      : null
  const skippedDay = session.status === 'skipped'

  return (
    <main className="px-4 pt-2 pb-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Home
      </Link>

      <header className="px-1 pt-4 pb-5">
        <p
          className={`label-caps ${
            session.status === 'completed'
              ? 'text-success'
              : skippedDay
                ? 'text-danger'
                : ''
          }`}
        >
          {STATUS_LABEL[session.status]}
        </p>
        <h1 className="mt-1.5 text-[22px] leading-tight font-bold tracking-tight text-primary">
          {sessionHeading(session)}
        </h1>
        <p className="mt-1 text-sm text-secondary">{formatLongDate(date)}</p>
      </header>

      {skippedDay ? (
        <p className="surface rounded-2xl px-5 py-6 text-center text-sm text-secondary">
          This day was marked as skipped.
        </p>
      ) : (
        <section
          className="surface grid grid-cols-3 gap-3 rounded-2xl p-5 text-center"
          aria-label="Session summary"
        >
          <Stat
            label="Duration"
            value={duration === null ? '—' : formatDuration(duration)}
          />
          <Stat label="Exercises" value={`${done} of ${total}`} />
          <Stat label="Sets" value={String(sets)} />
        </section>
      )}

      {total > 0 && (
        <section className="mt-3">
          <h2 className="label-caps px-1 pb-2">Exercises</h2>
          <div className="surface overflow-hidden rounded-2xl">
            <ul>
              {session.exercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="border-t border-hairline/60 px-5 py-4 first:border-t-0"
                >
                  <div className="flex items-start gap-3">
                    {exercise.status === 'completed' ? (
                      <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    ) : exercise.status === 'skipped' ? (
                      <SkipIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
                    ) : (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-faint" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-primary">
                        {exercise.exercise_name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-secondary">
                        {exercise.status === 'skipped'
                          ? 'Skipped'
                          : exercise.status === 'completed'
                            ? exercise.completed_at
                              ? `Completed at ${formatClockTime(exercise.completed_at)}`
                              : 'Completed'
                            : 'Not logged'}
                        {exercise.prescribed_reps &&
                          ` · Prescribed ${exercise.prescribed_reps}`}
                      </p>
                    </div>
                  </div>

                  {exercise.sets.length > 0 && (
                    <ol className="mt-2.5 ml-8 space-y-1">
                      {exercise.sets.map((set) => (
                        <li
                          key={set.id}
                          className="flex items-center gap-3 text-[14px] text-secondary tabular-nums"
                        >
                          <span className="label-caps w-12">
                            Set {set.set_number}
                          </span>
                          <span className="ml-auto text-primary">
                            {set.weight == null
                              ? '—'
                              : `${displayWeight(set.weight, unit)} ${unit}`}
                          </span>
                          <span className="w-16 text-right">
                            {set.reps_done ?? '—'} reps
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {exercise.comment && (
                    <p className="mt-2 ml-8 text-[13px] text-secondary italic">
                      “{exercise.comment}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mt-5">
        {session.status === 'in_progress' ? (
          isToday && (
            <Link
              href="/start"
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wide text-base uppercase transition-colors hover:bg-primary/90"
            >
              Continue on Start
            </Link>
          )
        ) : (
          <Link
            href={`/history/${date}?edit=1`}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl border border-hairline bg-card-raised text-sm font-bold tracking-wide text-primary uppercase transition-colors hover:bg-card-raised/70"
          >
            Edit logged workout
          </Link>
        )}
      </div>
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
