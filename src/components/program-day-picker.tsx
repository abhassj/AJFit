'use client'

import { useState } from 'react'

import { CalendarIcon } from '@/components/icons'
import {
  DAY_LABELS,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type Program,
} from '@/lib/program-types'

/**
 * Lets the user run a program day other than the one the calendar implies.
 *
 * Training weeks slip — a missed Monday gets done on Tuesday — and until now
 * the calendar weekday dictated which workout you were allowed to log. The
 * default stays the calendar's weekday, so the common case is still one tap;
 * this only opens up when asked for.
 *
 * Rest days and empty days are shown but disabled: seeing that Sunday is a rest
 * day is useful, silently hiding it is not.
 */
export function ProgramDayPicker({
  program,
  selected,
  defaultDay,
  onSelect,
  disabled,
}: {
  program: Program
  selected: DayOfWeek
  defaultDay: DayOfWeek
  onSelect: (day: DayOfWeek) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const isDefault = selected === defaultDay

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 py-3 text-[13px] font-semibold text-secondary transition-colors hover:text-primary disabled:opacity-40"
      >
        <CalendarIcon className="h-4 w-4" />
        {isDefault
          ? 'Do a different day’s workout instead'
          : `Doing ${DAY_LABELS[selected]}’s workout — change`}
      </button>
    )
  }

  return (
    <div className="surface rounded-xl p-4">
      <div className="flex items-center gap-2">
        <CalendarIcon className="h-3.5 w-3.5 text-faint" />
        <span className="label-caps">Which day’s workout?</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5">
        {DAYS_OF_WEEK.map((dow) => {
          const day = program.days.find((d) => d.day_of_week === dow)
          const count = day?.exercises.length ?? 0
          const unavailable = !day || day.is_rest_day || count === 0
          const active = dow === selected

          return (
            <button
              key={dow}
              type="button"
              disabled={unavailable}
              onClick={() => {
                onSelect(dow)
                setOpen(false)
              }}
              className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-left transition-colors ${
                active
                  ? 'bg-danger/15 text-primary ring-1 ring-danger/40'
                  : unavailable
                    ? 'text-faint'
                    : 'text-primary hover:bg-card-raised'
              }`}
            >
              <span className="w-10 shrink-0 text-[12px] font-bold tracking-[0.08em] uppercase">
                {dow.slice(0, 3)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px]">
                {day?.title?.trim() || DAY_LABELS[dow]}
              </span>
              <span className="shrink-0 text-[12px] text-faint">
                {day?.is_rest_day ? 'Rest' : count === 0 ? 'Empty' : `${count}`}
              </span>
              {dow === defaultDay && (
                <span className="shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-faint uppercase">
                  Today
                </span>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 w-full py-2 text-center text-[13px] font-semibold text-faint hover:text-primary"
      >
        Close
      </button>
    </div>
  )
}
