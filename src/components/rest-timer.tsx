'use client'

import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import { CheckIcon, ChevronRightIcon, SkipIcon } from '@/components/icons'
import { ActionButton } from '@/components/ui'
import { formatDuration } from '@/lib/session-types'
import { useNow } from '@/lib/use-now'

const RADIUS = 96
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Rest countdown between sets.
 *
 * Timestamp-based, not interval-based: the remaining time is always recomputed
 * as `duration - (now - startedAt)`. A naive setInterval that decrements a
 * counter drifts, and stops entirely when the phone locks or the tab is
 * backgrounded — which is exactly when someone is resting. Reading the clock
 * means the timer is correct the instant the screen comes back, however long
 * it was away, including having finished while hidden.
 *
 * The ring is one SVG circle whose stroke-dashoffset is animated by Framer;
 * nothing redraws per frame in JS.
 */
export function RestTimer({
  startedAt,
  seconds,
  exerciseName,
  onSkip,
  onNextSet,
}: {
  /**
   * Epoch ms when rest began. Passed in rather than read here: the clock is
   * captured in the event handler that starts the rest, which keeps this
   * component's render pure and makes the anchor survive re-renders.
   */
  startedAt: number
  seconds: number
  exerciseName: string
  onSkip: () => void
  onNextSet: () => void
}) {
  const now = useNow()
  const reduced = useReducedMotion()
  // A ref, not state: the latch only guards a side effect and must not itself
  // cause a render.
  const announcedRef = useRef(false)

  // now is 0 until mounted, so SSR and first paint agree.
  const elapsed = now === 0 ? 0 : Math.max(0, (now - startedAt) / 1000)
  const remaining = Math.max(0, seconds - elapsed)
  const done = now !== 0 && remaining <= 0
  const progress = seconds > 0 ? Math.min(1, elapsed / seconds) : 1

  /*
   * Fire once on completion. A rest timer that just silently stops is useless
   * mid-set, so this buzzes where the Vibration API exists — alongside the
   * visual state change below, never instead of it.
   */
  useEffect(() => {
    if (!done || announcedRef.current) return
    announcedRef.current = true
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 90, 200])
      } catch {
        // Vibration is best-effort; a blocked call must never break the timer.
      }
    }
  }, [done])

  return (
    <section
      className={`surface mt-3 rounded-2xl p-6 text-center transition-colors ${
        done ? 'border-success/50' : ''
      }`}
      data-testid="rest-timer"
      data-rest-done={done ? 'true' : 'false'}
      data-rest-remaining={Math.ceil(remaining)}
    >
      <h2 className="label-caps">{done ? 'Rest Complete' : 'Rest Time'}</h2>

      <div className="relative mx-auto mt-4 h-[224px] w-[224px]">
        <svg
          viewBox="0 0 224 224"
          className="h-full w-full -rotate-90"
          aria-hidden
        >
          <circle
            cx="112"
            cy="112"
            r={RADIUS}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth="10"
          />
          <m.circle
            cx="112"
            cy="112"
            r={RADIUS}
            fill="none"
            stroke={done ? 'var(--color-success)' : 'var(--color-danger)'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            // Animating the dash offset keeps the ring on the compositor path
            // rather than repainting an arc every frame.
            animate={{ strokeDashoffset: CIRCUMFERENCE * progress }}
            transition={
              reduced ? { duration: 0 } : { duration: 0.6, ease: 'linear' }
            }
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            className="font-mono text-[44px] leading-none font-bold tracking-tight text-primary tabular-nums"
            aria-live="polite"
          >
            {formatDuration(Math.ceil(remaining)).slice(3)}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-secondary">
            {done ? 'Ready for the next set' : `${seconds} sec`}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-faint">
        {done ? 'Rest finished for ' : 'Resting after '}
        <span className="text-secondary">{exerciseName}</span>
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <ActionButton onClick={onSkip}>
          <span className="flex items-center gap-2">
            <SkipIcon className="h-4 w-4" />
            Skip Rest
          </span>
        </ActionButton>
        <ActionButton tone={done ? 'primary' : 'danger'} onClick={onNextSet}>
          <span className="flex items-center gap-2">
            {done ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
            Next Set
          </span>
        </ActionButton>
      </div>
    </section>
  )
}
