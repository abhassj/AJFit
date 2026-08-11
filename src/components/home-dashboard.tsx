'use client'

import Link from 'next/link'

import { PlayIcon } from '@/components/icons'
import { StaggerItem, StaggerList } from '@/components/motion'
import { MonthCalendar, STATUS_STYLE } from '@/components/month-calendar'
import { DAY_SHORT } from '@/lib/program-types'
import type { HomeData, WeekDay } from '@/lib/home-types'

export function HomeDashboard({
  data,
  motto,
}: {
  data: HomeData
  motto: string | null
}) {
  const trimmedMotto = motto?.trim()

  return (
    <main className="px-4 pt-2">
      <header className="px-1 pb-5">
        <p className="label-caps">This Week</p>
        {/*
         * The motto takes the headline slot when set — a user-authored callback
         * to the tagline the original mockup carried as static art. With none
         * set the heading simply reads "Dashboard"; nothing renders an empty
         * box or placeholder copy pretending to be content.
         */}
        {trimmedMotto ? (
          <>
            <h1 className="mt-2 text-[30px] leading-[1.12] font-bold tracking-tight text-balance text-primary">
              {trimmedMotto}
            </h1>
            <p className="mt-2 text-[13px] font-semibold tracking-[0.14em] text-faint uppercase">
              Dashboard
            </p>
          </>
        ) : (
          <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
            Dashboard
          </h1>
        )}
      </header>

      <StaggerList className="space-y-3">
        <StaggerItem>
          <WeeklySummary week={data.week} />
        </StaggerItem>
        <StaggerItem>
          <TotalWorkouts stats={data.stats} />
        </StaggerItem>
        <StaggerItem>
          <MonthCalendar month={data.month} />
        </StaggerItem>
      </StaggerList>

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
