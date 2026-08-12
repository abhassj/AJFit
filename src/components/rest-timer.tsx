'use client'

import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import Image from 'next/image'

import { CheckIcon, ChevronRightIcon, SkipIcon } from '@/components/icons'
import { formatDuration } from '@/lib/session-types'
import { useNow } from '@/lib/use-now'

const RADIUS = 130
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
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      data-testid="rest-timer"
      data-rest-done={done ? 'true' : 'false'}
      data-rest-remaining={Math.ceil(remaining)}
    >
      {/* Meditative Background Image */}
      <Image
        src="/rest_bg.png"
        alt=""
        fill
        className="object-cover object-center opacity-80"
        priority
      />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 pt-24">
        <h2 className="mb-12 text-[16px] font-bold tracking-[0.2em] text-white/80 uppercase drop-shadow-md">
          {done ? 'Rest Complete' : 'Rest Time'}
        </h2>

        <div className="relative flex h-[320px] w-[320px] items-center justify-center rounded-full bg-black/40 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <svg
            viewBox="0 0 320 320"
            className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_0_12px_rgba(240,60,60,0.3)]"
            aria-hidden
          >
            <circle
              cx="160"
              cy="160"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="12"
            />
            <m.circle
              cx="160"
              cy="160"
              r={RADIUS}
              fill="none"
              stroke={done ? 'var(--color-success)' : 'var(--color-danger)'}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animate={{ strokeDashoffset: CIRCUMFERENCE * progress }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.6, ease: 'linear' }
              }
            />
          </svg>

          <div className="flex flex-col items-center justify-center">
            <p
              className="font-mono text-[84px] leading-none font-black tracking-tighter text-white tabular-nums drop-shadow-xl"
              aria-live="polite"
            >
              {formatDuration(Math.ceil(remaining)).slice(3)}
            </p>
            <p className="mt-4 text-[16px] font-semibold text-danger drop-shadow-md">
              {done ? 'Ready for the next set' : `${seconds} sec`}
            </p>
          </div>
        </div>

        <p className="mt-12 text-[15px] leading-relaxed text-white/60">
          {done ? 'Rest finished for ' : 'Resting after '}
          <span className="font-semibold text-white/90">{exerciseName}</span>
        </p>

        <div className="mt-auto w-full grid grid-cols-2 gap-4 pb-8">
          <button
            onClick={onSkip}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-[17px] font-bold text-white backdrop-blur-md transition-all active:scale-95 active:bg-white/10"
          >
            Skip Rest
          </button>
          <button
            onClick={onNextSet}
            className={`flex h-16 items-center justify-center gap-2 rounded-2xl border text-[17px] font-bold text-white backdrop-blur-md transition-all active:scale-95 ${
              done
                ? 'border-success/40 bg-success/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                : 'border-danger/40 bg-danger/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            }`}
          >
            Next Set
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </m.div>
  )
}
