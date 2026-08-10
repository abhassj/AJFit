'use client'

import Link from 'next/link'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useState, useTransition } from 'react'

import { loadMonth } from '@/app/(app)/month-actions'
import { ChevronRightIcon } from '@/components/icons'
import type { CalendarDay, DayStatus, HomeData } from '@/lib/home-types'

const DOW_HEADS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export const STATUS_STYLE: Record<DayStatus, { fill: string; label: string }> =
  {
    completed: { fill: 'bg-success', label: 'Completed' },
    skipped: { fill: 'bg-danger', label: 'Skipped' },
    rest: { fill: 'bg-secondary/45', label: 'Rest' },
    upcoming: { fill: 'bg-hairline', label: 'Upcoming' },
    missed: { fill: 'bg-faint/35', label: 'Not logged' },
  }

/**
 * Monthly view with swipe-to-change-month.
 *
 * Months other than the one the page shipped with are fetched on demand rather
 * than preloading neighbours, since most visits never leave the current month.
 */
export function MonthCalendar({ month }: { month: HomeData['month'] }) {
  const [view, setView] = useState({
    year: month.year,
    month: month.month,
    label: month.label,
    days: month.days,
  })
  const [direction, setDirection] = useState(0)
  const [pending, startTransition] = useTransition()
  const reduced = useReducedMotion()

  function shift(delta: number) {
    const target = new Date(view.year, view.month + delta, 1)
    setDirection(delta)
    startTransition(async () => {
      const result = await loadMonth(target.getFullYear(), target.getMonth())
      if (result.ok) {
        setView({
          year: target.getFullYear(),
          month: target.getMonth(),
          label: result.label,
          days: result.days,
        })
      }
    })
  }

  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="label-caps">Monthly View</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            disabled={pending}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:text-primary disabled:opacity-40"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <span className="min-w-[7.5rem] text-center text-[13px] font-semibold text-primary">
            {view.label}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={pending}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:text-primary disabled:opacity-40"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* The hint the calendar previously lacked — days did not look tappable. */}
      <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
        Tap any past day to view or log that workout. Swipe to change month.
      </p>

      <div className="mt-3.5 grid grid-cols-7 gap-1">
        {DOW_HEADS.map((d) => (
          <span
            key={d}
            className="pb-1 text-center text-[11px] font-semibold text-faint"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={`${view.year}-${view.month}`}
            className="grid grid-cols-7 gap-1"
            initial={
              reduced ? false : { opacity: 0, x: direction > 0 ? 40 : -40 }
            }
            animate={{ opacity: pending ? 0.5 : 1, x: 0 }}
            exit={
              reduced ? undefined : { opacity: 0, x: direction > 0 ? -40 : 40 }
            }
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            drag={reduced ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) shift(1)
              else if (info.offset.x > 50) shift(-1)
            }}
          >
            {view.days.map((day, i) => (
              <CalendarCell key={day.date ?? `blank-${i}`} day={day} />
            ))}
          </m.div>
        </AnimatePresence>
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

  // Future days have nothing to show and nothing to log yet. This keys off
  // isFuture rather than status: a future rest day resolves to `rest`, and
  // would otherwise slip through as tappable.
  if (day.isFuture && !day.sessionId) {
    return (
      <span className={`${base} text-faint/60 ${today}`}>{day.dayOfMonth}</span>
    )
  }

  const tone = day.sessionId
    ? day.status === 'completed'
      ? 'bg-success/20 text-success font-semibold hover:bg-success/30'
      : 'bg-danger/20 text-danger font-semibold hover:bg-danger/30'
    : day.status === 'rest'
      ? 'bg-card-raised/40 text-faint hover:bg-card-raised'
      : 'text-secondary hover:bg-card-raised'

  const label = day.sessionId
    ? `${day.date}, ${STATUS_STYLE[day.status ?? 'missed'].label} — open session`
    : `${day.date}, no session — log this day`

  return (
    <Link
      href={`/history/${day.date}`}
      aria-label={label}
      className={`${base} ${tone} ${today}`}
    >
      {day.dayOfMonth}
    </Link>
  )
}
