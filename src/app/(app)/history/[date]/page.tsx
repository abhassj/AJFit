import { notFound } from 'next/navigation'

import { DayDetail } from '@/components/day-detail'
import { DayLogger } from '@/components/day-logger'
import { getViewerUnits } from '@/lib/profile'
import { getProgramDay } from '@/lib/program'
import { DAYS_OF_WEEK } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { getViewerDateKey } from '@/lib/viewer-time'
import { getWeekLocks } from '@/lib/week-lock'

type PageProps = {
  params: Promise<{ date: string }>
  searchParams: Promise<{ edit?: string }>
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const { date } = await params
  return { title: `${date} · AJFit` }
}

export default async function DayPage({ params, searchParams }: PageProps) {
  const { date } = await params
  const editing = (await searchParams).edit === '1'

  // A malformed date is a bad URL, not a server error — never reaches Postgres.
  if (!DATE_KEY.test(date)) notFound()

  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (Number.isNaN(parsed.getTime())) notFound()

  const dow = DAYS_OF_WEEK[(parsed.getDay() + 6) % 7]
  const [session, { program }, today, weekLocks, units] = await Promise.all([
    getSessionForDate(date),
    getProgramDay(dow),
    getViewerDateKey(),
    getWeekLocks(date),
    getViewerUnits(),
  ])

  /*
   * A logged day opens read-only; the editor is one tap further, behind
   * "Edit logged workout" (?edit=1). An in-progress session is never edited
   * from here — the live runner on Start owns it. Days with nothing logged
   * still open straight into the backfill flow.
   */
  if (session && (!editing || session.status === 'in_progress')) {
    return (
      <DayDetail
        date={date}
        session={session}
        unit={units.weight}
        isToday={date === today}
      />
    )
  }

  return (
    <DayLogger
      date={date}
      session={session}
      program={program}
      calendarDow={dow}
      isFuture={date > today}
      weekLocks={weekLocks}
      doneHref={session ? `/history/${date}` : undefined}
    />
  )
}
