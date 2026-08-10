import 'server-only'

import { getOrCreateProgram } from '@/lib/program'
import type { DayOfWeek } from '@/lib/program-types'
import { createClient } from '@/lib/supabase/server'
import {
  addDays,
  dateKey,
  monthGrid,
  monthLabel,
  startOfWeek,
  weekDates,
  type CalendarDay,
  type DayStatus,
  type HomeData,
  type WeekDay,
} from '@/lib/home-types'

const DOW_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

/** Monday-first weekday for a Date, matching the program's day_of_week. */
function dowFor(date: Date): DayOfWeek {
  return DOW_ORDER[(date.getDay() + 6) % 7]
}

type SessionRow = {
  id: string
  session_date: string
  status: 'completed' | 'skipped' | 'in_progress'
}

/**
 * Resolves one calendar day.
 *
 * An in-progress session counts as neither completed nor skipped — it falls
 * through to the same treatment as an unlogged day so a half-finished session
 * never inflates the summary.
 */
function resolveStatus(
  session: SessionRow | undefined,
  isRestDay: boolean,
  date: string,
  today: string,
): DayStatus {
  if (session?.status === 'completed') return 'completed'
  if (session?.status === 'skipped') return 'skipped'
  if (isRestDay) return 'rest'
  // Today counts as upcoming until something is logged — the day is not over.
  if (date >= today) return 'upcoming'
  return 'missed'
}

/** Builds the padded month grid for a given year/month, with session state. */
async function buildMonth(
  year: number,
  month: number,
  now: Date,
): Promise<{ label: string; days: CalendarDay[] }> {
  const supabase = await createClient()
  const today = dateKey(now)

  const monthStart = dateKey(new Date(year, month, 1))
  const monthEnd = dateKey(new Date(year, month + 1, 0))

  const [sessionsResult, program] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_date, status')
      .gte('session_date', monthStart)
      .lte('session_date', monthEnd),
    getOrCreateProgram(),
  ])

  if (sessionsResult.error) {
    throw new Error(`Failed to load sessions: ${sessionsResult.error.message}`)
  }

  const byDate = new Map<string, SessionRow>()
  for (const s of (sessionsResult.data ?? []) as SessionRow[]) {
    const existing = byDate.get(s.session_date)
    if (!existing || existing.status === 'in_progress') {
      byDate.set(s.session_date, s)
    }
  }

  const restByDow = new Map<DayOfWeek, boolean>(
    program.days.map((d) => [d.day_of_week, d.is_rest_day]),
  )

  const days: CalendarDay[] = monthGrid(year, month).map((date) => {
    if (!date) {
      return {
        date: null,
        dayOfMonth: null,
        status: null,
        isToday: false,
        isFuture: false,
        sessionId: null,
      }
    }
    const key = dateKey(date)
    const session = byDate.get(key)
    return {
      date: key,
      dayOfMonth: date.getDate(),
      status: resolveStatus(
        session,
        restByDow.get(dowFor(date)) ?? false,
        key,
        today,
      ),
      isToday: key === today,
      isFuture: key > today,
      sessionId: session?.id ?? null,
    }
  })

  return { label: monthLabel(month, year), days }
}

/** A single month's calendar, used by the Home calendar's month swipe. */
export async function getMonthCalendar(year: number, month: number) {
  return buildMonth(year, month, new Date())
}

/**
 * Everything the dashboard renders, in as few round trips as practical.
 *
 * Sessions for the week and the month are fetched as one range query and split
 * in memory, since the two windows overlap for most of the month.
 */
export async function getHomeData(now: Date = new Date()): Promise<HomeData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const today = dateKey(now)
  const year = now.getFullYear()
  const month = now.getMonth()

  const weekStartDate = startOfWeek(now)
  const weekEndDate = addDays(weekStartDate, 6)
  const monthStartDate = new Date(year, month, 1)
  const monthEndDate = new Date(year, month + 1, 0)

  // One range wide enough to cover both windows.
  const rangeStart = dateKey(
    weekStartDate < monthStartDate ? weekStartDate : monthStartDate,
  )
  const rangeEnd = dateKey(
    weekEndDate > monthEndDate ? weekEndDate : monthEndDate,
  )

  const thirtyDayStart = dateKey(addDays(now, -29))

  const [sessionsResult, totalResult, recentResult, program] =
    await Promise.all([
      supabase
        .from('sessions')
        .select('id, session_date, status')
        .gte('session_date', rangeStart)
        .lte('session_date', rangeEnd)
        .order('session_date'),
      supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('session_date', thirtyDayStart)
        .lte('session_date', today),
      getOrCreateProgram(),
    ])

  if (sessionsResult.error) {
    throw new Error(`Failed to load sessions: ${sessionsResult.error.message}`)
  }

  const sessions = (sessionsResult.data ?? []) as SessionRow[]
  const byDate = new Map<string, SessionRow>()
  for (const s of sessions) {
    // A day holds at most one session; prefer a resolved one over in_progress.
    const existing = byDate.get(s.session_date)
    if (!existing || existing.status === 'in_progress')
      byDate.set(s.session_date, s)
  }

  const restByDow = new Map<DayOfWeek, boolean>(
    program.days.map((d) => [d.day_of_week, d.is_rest_day]),
  )

  const week: WeekDay[] = weekDates(now).map(({ date, day_of_week }) => {
    const key = dateKey(date)
    const session = byDate.get(key)
    return {
      date: key,
      day_of_week,
      status: resolveStatus(
        session,
        restByDow.get(day_of_week) ?? false,
        key,
        today,
      ),
      isToday: key === today,
      sessionId: session?.id ?? null,
    }
  })

  const days: CalendarDay[] = monthGrid(year, month).map((date) => {
    if (!date) {
      return {
        date: null,
        dayOfMonth: null,
        status: null,
        isToday: false,
        isFuture: false,
        sessionId: null,
      }
    }
    const key = dateKey(date)
    const session = byDate.get(key)
    return {
      date: key,
      dayOfMonth: date.getDate(),
      status: resolveStatus(
        session,
        restByDow.get(dowFor(date)) ?? false,
        key,
        today,
      ),
      isToday: key === today,
      isFuture: key > today,
      sessionId: session?.id ?? null,
    }
  })

  return {
    week,
    weekStart: dateKey(weekStartDate),
    weekEnd: dateKey(weekEndDate),
    month: { year, month, label: monthLabel(month, year), days },
    stats: {
      totalCompleted: totalResult.count ?? 0,
      completedLast30Days: recentResult.count ?? 0,
    },
  }
}
