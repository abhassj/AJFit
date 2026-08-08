import { notFound } from 'next/navigation'

import { SessionDetail } from '@/components/session-detail'
import { getSessionForDate } from '@/lib/session'

type PageProps = { params: Promise<{ date: string }> }

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const { date } = await params
  return { title: `${date} · AJFit` }
}

export default async function SessionHistoryPage({ params }: PageProps) {
  const { date } = await params

  // A malformed date is a bad URL, not a server error — never reaches Postgres.
  if (!DATE_KEY.test(date)) notFound()

  const session = await getSessionForDate(date)
  if (!session) notFound()

  return <SessionDetail session={session} />
}
