'use client'

import { useEffect, useTransition } from 'react'

import { AlertIcon } from '@/components/icons'

/**
 * The fallback every error boundary in the app renders.
 *
 * Two things it deliberately does not do:
 *
 * 1. It does not print `error.message`. Next replaces the message of anything
 *    thrown in a Server Component with a generic string in production
 *    specifically so server internals cannot leak to the client, so showing it
 *    would give the user either nothing useful or, in development, a Postgres
 *    error string they cannot act on. The digest is surfaced instead — it is
 *    the handle that matches a line in the server log.
 *
 * 2. It does not pretend the failure is the user's fault. Almost every error
 *    that reaches here is a Supabase request that did not come back: a dropped
 *    connection in a basement gym, a phone that woke up on a different network.
 *    Retrying is genuinely likely to work, so retry is the primary action.
 *
 * `unstable_retry` is the Next 16 prop — it re-fetches and re-renders the
 * boundary's children in place, which is a real retry rather than a full page
 * reload that would throw away client state elsewhere in the tree.
 */
export function ErrorState({
  error,
  retry,
  title = 'Could not load this page',
  description = 'Something went wrong reaching your data. This is usually a dropped connection rather than anything lost.',
}: {
  error: Error & { digest?: string }
  retry: () => void
  title?: string
  description?: string
}) {
  // useTransition keeps the button responsive while the segment re-renders,
  // and gives us a pending state to disable double-taps.
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    // The browser console is the only error reporting this app has; without
    // this line a production digest has nothing on the client side to match.
    console.error('AJFit error boundary:', error)
  }, [error])

  return (
    <main className="px-4 pt-2">
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center backdrop-blur-xl shadow-2xl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-danger/40 bg-danger/10">
          <AlertIcon className="h-6 w-6 text-danger" />
        </span>

        <h1 className="mt-4 text-[20px] leading-snug font-bold tracking-tight text-primary">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-secondary">
          {description}
        </p>

        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => retry())}
          className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wide text-base uppercase transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? 'Retrying…' : 'Try again'}
        </button>

        {/*
         * A plain anchor, not a Link, and the lint rule is suppressed on
         * purpose. next/link would perform a client-side navigation against the
         * same router and the same cached RSC payload that just failed; when
         * this component is rendered by src/app/error.tsx the broken segment is
         * the app shell itself, so a soft navigation re-renders the very tree
         * that threw. A full document request is the one escape hatch that
         * cannot inherit the failure it is escaping.
         */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-3 flex min-h-[48px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-secondary transition-colors hover:text-primary"
        >
          Back to Home
        </a>

        {error.digest && (
          <p className="mt-5 font-mono text-[11px] tracking-wide text-faint">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
