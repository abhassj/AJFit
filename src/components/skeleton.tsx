/**
 * Loading placeholders.
 *
 * These are Server Components with no client JavaScript at all — a loading
 * state that has to hydrate before it can appear defeats the point. The pulse
 * is a CSS animation for the same reason, and it is suppressed under
 * prefers-reduced-motion by the rule in globals.css.
 *
 * Each page's skeleton mirrors the real layout's block sizes rather than
 * showing a generic spinner, so the content lands without the page jumping —
 * the shapes are already the right height when the data arrives.
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`}
    />
  )
}

/**
 * The masthead every page opens with: a small caps label over a large heading.
 */
export function SkeletonHeader({ wide = false }: { wide?: boolean }) {
  return (
    <header className="px-1 pb-5">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className={`mt-2.5 h-7 ${wide ? 'w-56' : 'w-40'}`} />
    </header>
  )
}

/**
 * Wraps a skeleton so screen readers announce the wait instead of reading out
 * a screenful of empty boxes.
 */
export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-4 pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </main>
  )
}
