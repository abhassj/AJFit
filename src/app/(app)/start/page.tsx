import { SessionRunner } from '@/components/session-runner'
import { SessionSummary, StartWorkout } from '@/components/start-workout'
import { pageTitle } from '@/lib/brand'
import { getOrCreateProgram } from '@/lib/program'
import { DAY_LABELS } from '@/lib/program-types'
import { getPersonalRecords } from '@/lib/prs'
import { getSessionForDate } from '@/lib/session'
import { getWeekLocks } from '@/lib/week-lock'
import { sessionHeading } from '@/lib/session-types'
import { getViewerDayOfWeek } from '@/lib/viewer-time'

export const metadata = { title: pageTitle('Start Workout') }

// Today's date and today's session both change outside this render, so never
// serve this page from a cache.
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const dow = await getViewerDayOfWeek()
  const [program, session] = await Promise.all([
    getOrCreateProgram(),
    getSessionForDate(),
  ])

  const dayLabel = DAY_LABELS[dow]

  /*
   * Once a session exists, everything on screen describes THAT session: the
   * heading is the title of the program day it follows, which may well not be
   * today's weekday. Today's weekday only decides the default on the screen
   * before a session is started.
   */
  if (session && session.status === 'in_progress') {
    // One call for every exercise on screen, excluding this session, so each
    // PR shown is the one to beat.
    const records = await getPersonalRecords(
      session.exercises.map((e) => e.exercise_name),
      session.id,
    )
    return (
      <SessionRunner
        session={session}
        dayTitle={sessionHeading(session)}
        records={records}
      />
    )
  }

  if (session) {
    return (
      <SessionSummary session={session} heading={sessionHeading(session)} />
    )
  }

  const [locks, records] = await Promise.all([
    getWeekLocks(),
    getPersonalRecords(
      program.days.flatMap((d) => d.exercises.map((e) => e.exercise_name)),
    ),
  ])

  return (
    <StartWorkout
      program={program}
      todayDow={dow}
      dayLabel={dayLabel}
      locks={locks}
      records={records}
    />
  )
}
