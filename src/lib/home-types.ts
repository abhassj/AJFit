/**
 * Dashboard shapes and pure date helpers, free of server-only imports so
 * Client Components can use them. Queries live in `@/lib/home`.
 */

import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/program-types'

/**
 * What a single day resolves to on the dashboard.
 *
 * `rest`, `upcoming` and `missed` are all "no session logged" — they are kept
 * apart because the PRD's whole point is that an intentional rest reads
 * differently from a day that simply has not happened yet, which in turn reads
 * differently from one that was left unlogged (PRD §8.4).
 */
export type DayStatus = 'completed' | 'skipped' | 'rest' | 'upcoming' | 'missed'

export type WeekDay = {
  date: string
  day_of_week: DayOfWeek
  status: DayStatus
  isToday: boolean
  sessionId: string | null
}

export type CalendarDay = {
  /** null for the leading/trailing blanks that pad the grid. */
  date: string | null
  dayOfMonth: number | null
  status: DayStatus | null
  isToday: boolean
  sessionId: string | null
}

export type HomeData = {
  week: WeekDay[]
  weekStart: string
  weekEnd: string
  month: {
    year: number
    /** 0-indexed, as returned by Date#getMonth. */
    month: number
    label: string
    days: CalendarDay[]
  }
  bodyweight: {
    current: number | null
    currentLoggedOn: string | null
    goal: number | null
  }
  stats: {
    totalCompleted: number
    completedLast30Days: number
  }
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthLabel(month: number, year: number) {
  return `${MONTH_LABELS[month]} ${year}`
}

/** Local calendar date as YYYY-MM-DD; avoids toISOString's UTC shift. */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday of the week containing `d`, in local time. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // getDay() is 0=Sunday; the program week runs Monday-first.
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() + n)
  return out
}

/** The seven dates of the week containing `d`, Monday first. */
export function weekDates(d: Date): { date: Date; day_of_week: DayOfWeek }[] {
  const monday = startOfWeek(d)
  return DAYS_OF_WEEK.map((day_of_week, i) => ({
    date: addDays(monday, i),
    day_of_week,
  }))
}

/**
 * Calendar cells for a month, padded so the grid always starts on Monday and
 * fills whole weeks.
 */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7

  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Formats a YYYY-MM-DD key for display, e.g. "Friday, 7 August 2026". */
export function formatLongDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
