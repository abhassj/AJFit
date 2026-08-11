import { SessionRunner } from '@/components/session-runner'
import { SessionSummary, StartWorkout } from '@/components/start-workout'
import { getProgramDay } from '@/lib/program'
import { DAY_LABELS, todayDayOfWeek } from '@/lib/program-types'
import { getSessionForDate } from '@/lib/session'

export const metadata = { title: 'Start Workout · AJFit' }

// Today's date and today's session both change outside this render, so never
// serve this page from a cache.
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const dow = todayDayOfWeek()
  const [{ program, day }, session] = await Promise.all([
    getProgramDay(dow),
    getSessionForDate(),
  ])

  const dayLabel = DAY_LABELS[dow]

  if (session && session.status === 'in_progress') {
    return (
      <SessionRunner
        session={session}
        dayTitle={day.title?.trim() || dayLabel}
      />
    )
  }

  if (session) {
    return <SessionSummary session={session} dayLabel={dayLabel} />
  }

  return <StartWorkout program={program} todayDow={dow} dayLabel={dayLabel} />
}
