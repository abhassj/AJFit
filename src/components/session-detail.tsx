import Link from 'next/link'

import { ArrowLeftIcon, CheckIcon, SkipIcon } from '@/components/icons'
import { formatLongDate } from '@/lib/home-types'
import {
  formatClockTime,
  formatDuration,
  type WorkoutSession,
} from '@/lib/session-types'

/**
 * Read-only detail for a session on a past date, reached from the Home
 * calendar. Shows the same shape of data the Start Workout summary does, but
 * framed as history: dated heading, no next-session prompt, back to Home.
 */
export function SessionDetail({ session }: { session: WorkoutSession }) {
  const skipped = session.status === 'skipped'
  const inProgress = session.status === 'in_progress'

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
    <main className="px-4 pt-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Home
      </Link>

      <header className="px-1 pt-4 pb-5">
        <p className="label-caps">
          {skipped ? 'Skipped' : inProgress ? 'In Progress' : 'Completed'}
        </p>
        <h1 className="mt-1.5 text-[22px] leading-tight font-bold tracking-tight text-primary">
          {formatLongDate(session.session_date)}
        </h1>
      </header>

      {skipped ? (
        <p className="surface rounded-2xl px-5 py-6 text-center text-sm text-secondary">
          This day was explicitly marked as skipped. No sets were logged.
        </p>
      ) : (
        <section className="surface rounded-2xl p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat
              label="Duration"
              value={workingSeconds > 0 ? formatDuration(workingSeconds) : '—'}
            />
            <Stat label="Exercises" value={`${completed.length}`} />
            <Stat label="Sets" value={`${totalSets}`} />
          </div>

          <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-[13px]">
            <Row label="Started" value={formatClockTime(session.start_time)} />
            <Row
              label="Finished"
              value={
                session.end_time
                  ? formatClockTime(session.end_time)
                  : 'Not finished'
              }
            />
            <Row
              label="Paused"
              value={
                session.paused_seconds > 0
                  ? formatDuration(session.paused_seconds)
                  : 'None'
              }
            />
          </dl>
        </section>
      )}

      {session.exercises.length > 0 && (
        <section className="mt-3">
          <h2 className="label-caps px-1 pb-2">Exercises</h2>
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
                        {exercise.prescribed_reps &&
                          ` · prescribed ${exercise.prescribed_reps}`}
                      </p>

                      {exercise.sets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {exercise.sets.map((set) => (
                            <li
                              key={set.id}
                              className="flex items-center gap-3 rounded-lg bg-card-raised/50 px-3 py-1.5 text-[13px] text-secondary tabular-nums"
                            >
                              <span className="label-caps">
                                Set {set.set_number}
                              </span>
                              <span className="ml-auto text-primary">
                                {set.reps_done ?? '—'} reps ×{' '}
                                {set.weight ?? '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {exercise.comment && (
                        <p className="mt-2 text-[13px] text-secondary italic">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-secondary tabular-nums">{value}</dd>
    </div>
  )
}
