'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { logBodyweight, saveGoalBodyweight } from '@/app/(app)/actions'
import { PlayIcon } from '@/components/icons'
import { ActionButton, Banner } from '@/components/ui'
import { DAY_SHORT } from '@/lib/program-types'
import type {
  CalendarDay,
  DayStatus,
  HomeData,
  WeekDay,
} from '@/lib/home-types'

const DOW_HEADS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** One colour vocabulary for day state, shared by the week bar and calendar. */
const STATUS_STYLE: Record<DayStatus, { fill: string; label: string }> = {
  completed: { fill: 'bg-success', label: 'Completed' },
  skipped: { fill: 'bg-danger', label: 'Skipped' },
  rest: { fill: 'bg-secondary/45', label: 'Rest' },
  upcoming: { fill: 'bg-hairline', label: 'Upcoming' },
  missed: { fill: 'bg-faint/35', label: 'Not logged' },
}

export function HomeDashboard({
  data,
  email,
}: {
  data: HomeData
  email: string
}) {
  return (
    <main className="px-4 pt-8">
      <header className="px-1 pb-5">
        <p className="label-caps">AJFit</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          Dashboard
        </h1>
        <p className="mt-1 truncate text-[13px] text-secondary">{email}</p>
      </header>

      <div className="space-y-3">
        <WeeklySummary week={data.week} />
        <TotalWorkouts stats={data.stats} />
        <MonthlyCalendar month={data.month} />
        <Bodyweight bodyweight={data.bodyweight} />
      </div>

      <div className="sticky bottom-4 mt-5">
        <Link
          href="/start"
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold tracking-wide text-base uppercase transition-colors hover:bg-primary/90"
        >
          <PlayIcon className="h-5 w-5" />
          Start Workout
        </Link>
      </div>
    </main>
  )
}

/**
 * Segmented progress bar from the mockup: one segment per day, filled by
 * status, rather than a plain table of days.
 */
function WeeklySummary({ week }: { week: WeekDay[] }) {
  const completed = week.filter((d) => d.status === 'completed').length
  const skipped = week.filter((d) => d.status === 'skipped').length
  const rest = week.filter((d) => d.status === 'rest').length
  const trainingDays = week.length - rest

  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-caps">Weekly Workout Summary</h2>
        <span className="font-mono text-[13px] font-bold text-primary tabular-nums">
          {completed}/{trainingDays}
        </span>
      </div>

      <div
        className="mt-3.5 flex gap-1.5"
        role="img"
        aria-label={weekAriaLabel(week)}
      >
        {week.map((day) => (
          <div key={day.date} className="flex-1">
            <div
              className={`h-2.5 rounded-full transition-colors ${STATUS_STYLE[day.status].fill} ${
                day.isToday
                  ? 'ring-2 ring-primary/70 ring-offset-2 ring-offset-card'
                  : ''
              }`}
            />
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        {week.map((day) => (
          <span
            key={day.date}
            className={`flex-1 text-center text-[10px] font-semibold tracking-wide uppercase ${
              day.isToday ? 'text-primary' : 'text-faint'
            }`}
          >
            {DAY_SHORT[day.day_of_week]}
          </span>
        ))}
      </div>

      <p className="mt-3.5 text-[13px] text-secondary">
        {completed} completed
        {skipped > 0 && ` · ${skipped} skipped`}
        {rest > 0 && ` · ${rest} rest`}
      </p>
    </section>
  )
}

function weekAriaLabel(week: WeekDay[]) {
  return week
    .map((d) => `${DAY_SHORT[d.day_of_week]}: ${STATUS_STYLE[d.status].label}`)
    .join(', ')
}

/** The "distinct treatment" stat card — two figures, not a bare number. */
function TotalWorkouts({ stats }: { stats: HomeData['stats'] }) {
  return (
    <section className="surface rounded-2xl p-5">
      <h2 className="label-caps">Workouts Completed</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-hairline bg-card-raised/50 p-4">
          <p className="font-mono text-[34px] leading-none font-bold text-primary tabular-nums">
            {stats.totalCompleted}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            All time
          </p>
        </div>
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
          <p className="font-mono text-[34px] leading-none font-bold text-danger tabular-nums">
            {stats.completedLast30Days}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            Last 30 days
          </p>
        </div>
      </div>
    </section>
  )
}

function MonthlyCalendar({ month }: { month: HomeData['month'] }) {
  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-caps">Monthly View</h2>
        <span className="text-[13px] font-semibold text-primary">
          {month.label}
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-7 gap-1">
        {DOW_HEADS.map((d) => (
          <span
            key={d}
            className="pb-1 text-center text-[11px] font-semibold text-faint"
          >
            {d}
          </span>
        ))}
        {month.days.map((day, i) => (
          <CalendarCell key={day.date ?? `blank-${i}`} day={day} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {(['completed', 'skipped', 'rest'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].fill}`} />
            <span className="text-[11px] text-faint">
              {STATUS_STYLE[s].label}
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}

function CalendarCell({ day }: { day: CalendarDay }) {
  if (!day.date) return <span className="aspect-square" />

  const base =
    'flex aspect-square items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors'
  const today = day.isToday ? 'ring-1 ring-primary/70' : ''

  // Only days with a logged session are actionable; everything else is inert.
  if (!day.sessionId) {
    const tone =
      day.status === 'rest' ? 'bg-card-raised/40 text-faint' : 'text-secondary'
    return <span className={`${base} ${tone} ${today}`}>{day.dayOfMonth}</span>
  }

  const tone =
    day.status === 'completed'
      ? 'bg-success/20 text-success font-semibold hover:bg-success/30'
      : 'bg-danger/20 text-danger font-semibold hover:bg-danger/30'

  return (
    <Link
      href={`/history/${day.date}`}
      aria-label={`${day.date}, ${STATUS_STYLE[day.status ?? 'missed'].label} — open session`}
      className={`${base} ${tone} ${today}`}
    >
      {day.dayOfMonth}
    </Link>
  )
}

function Bodyweight({ bodyweight }: { bodyweight: HomeData['bodyweight'] }) {
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState(bodyweight.goal?.toString() ?? '')
  const [message, setMessage] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  function run(
    fn: () => Promise<ActionOutcome>,
    success: string,
    after?: () => void,
  ) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        setMessage({ tone: 'success', text: success })
        after?.()
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  const delta =
    bodyweight.current !== null && bodyweight.goal !== null
      ? bodyweight.current - bodyweight.goal
      : null

  return (
    <section className="surface rounded-2xl p-5">
      <h2 className="label-caps">Bodyweight</h2>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[34px] leading-none font-bold text-primary tabular-nums">
            {bodyweight.current ?? '—'}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            {bodyweight.currentLoggedOn
              ? `Logged ${bodyweight.currentLoggedOn}`
              : 'No entries yet'}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-secondary tabular-nums">
            {bodyweight.goal ?? '—'}
          </p>
          <p className="mt-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            Goal
          </p>
        </div>
      </div>

      {delta !== null && (
        <p className="mt-2 text-[13px] text-secondary">
          {Math.abs(delta) < 0.05
            ? 'At your goal.'
            : `${Math.abs(delta).toFixed(1)} ${delta > 0 ? 'above' : 'below'} goal.`}
        </p>
      )}

      {message && (
        <div className="mt-3">
          <Banner tone={message.tone}>{message.text}</Banner>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="label-caps">Log today’s weight</span>
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              placeholder="e.g. 78.5"
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-hairline bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint"
            />
          </label>
          <ActionButton
            tone="primary"
            disabled={pending || weight.trim() === ''}
            className="shrink-0 px-5"
            onClick={() =>
              run(
                () => logBodyweight(Number(weight)),
                'Weight logged.',
                () => setWeight(''),
              )
            }
          >
            Add
          </ActionButton>
        </div>

        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="label-caps">Goal weight</span>
            <input
              type="text"
              inputMode="decimal"
              value={goal}
              placeholder="e.g. 75"
              onChange={(e) => setGoal(e.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-hairline bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint"
            />
          </label>
          <ActionButton
            disabled={pending}
            className="shrink-0 px-5"
            onClick={() =>
              run(
                () =>
                  saveGoalBodyweight(goal.trim() === '' ? null : Number(goal)),
                'Goal saved.',
              )
            }
          >
            Save
          </ActionButton>
        </div>
      </div>
    </section>
  )
}

type ActionOutcome = { ok: true } | { ok: false; error: string }
