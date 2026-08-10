import { notFound } from 'next/navigation'

import { DayLogger } from '@/components/day-logger'
import { getProgramDay } from '@/lib/program'
import { DAYS_OF_WEEK, localDateKey } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'

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
  const [session, { day }] = await Promise.all([
    getSessionForDate(date),
    getProgramDay(dow),
  ])

  return (
    <DayLogger
      date={date}
      session={session}
      day={day}
      isFuture={date > localDateKey()}
    />
  )
}
