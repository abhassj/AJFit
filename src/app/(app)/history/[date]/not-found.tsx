import Link from 'next/link'

import { ArrowLeftIcon } from '@/components/icons'

export default function SessionNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-primary">
        No session logged
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-secondary">
        Nothing was recorded for that date.
      </p>
      <Link
        href="/"
        className="surface inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-card-raised"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Home
      </Link>
    </main>
  )
}
