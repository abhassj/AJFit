'use client'

import './globals.css'

/**
 * Last-resort boundary, for a failure in the root layout itself.
 *
 * When this renders it has replaced the root layout, so it has to supply its
 * own <html> and <body> and its own stylesheet import — none of the tokens or
 * fonts the rest of the app relies on are mounted at this point. That is also
 * why the styling here is inline and self-contained rather than reaching for
 * the shared ErrorState component and the Tailwind classes it assumes: if the
 * root layout could not render, the safest assumption is that nothing set up by
 * the root layout is available.
 *
 * A full reload is the recovery offered here rather than a partial retry. The
 * failure is in the document shell, so there is no inner segment worth
 * re-rendering on its own.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#13161B',
          color: '#F6F9FE',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: '22rem', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            AJFit could not start
          </h1>
          <p
            style={{
              marginTop: '8px',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#8B9099',
            }}
          >
            Something failed before the app could load. Reloading usually fixes
            it.
          </p>

          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: '24px',
              minHeight: '52px',
              width: '100%',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#F6F9FE',
              color: '#13161B',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p
              style={{
                marginTop: '20px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '11px',
                color: '#6E6E6E',
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
