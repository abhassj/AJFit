import { notFound } from 'next/navigation'

import { DayLogger } from '@/components/day-logger'
import { getProgramDay } from '@/lib/program'
import { DAYS_OF_WEEK } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'
import { getViewerDateKey } from '@/lib/viewer-time'

type PageProps = { params: Promise<{ date: string }> }

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const { date } = await params
  return { title: `${date} · AJFit` }
}

export default async function DayPage({ params }: PageProps) {
  const { date } = await params

  // A malformed date is a bad URL, not a server error — never reaches Postgres.
  if (!DATE_KEY.test(date)) notFound()

  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(y, m - 1, d)
  if (Number.isNaN(parsed.getTime())) notFound()

  const dow = DAYS_OF_WEEK[(parsed.getDay() + 6) % 7]
  const [session, { program }, today] = await Promise.all([
    getSessionForDate(date),
    getProgramDay(dow),
    getViewerDateKey(),
  ])

  return (
    <DayLogger
      date={date}
      session={session}
      program={program}
      calendarDow={dow}
      isFuture={date > today}
    />
  )
}
