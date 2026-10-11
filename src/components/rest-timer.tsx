'use client'

import { m, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import Image from 'next/image'

import { ChevronRightIcon } from '@/components/icons'
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
/*
 * One control, two labels (decision D14). While the countdown runs it reads
 * "Skip Rest"; once it reaches zero it reads "Next Set". Both do the same
 * thing — close rest and put the keypad back on reps — because from the
 * user's side it is one decision: "I'm ready". The old overlay had two buttons
 * with two handlers that differed only in whether the keypad was reset.
 */
export function RestTimer({
  startedAt,
  seconds,
  exerciseName,
  nextSet,
  totalSets,
  onDone,
}: {
  /**
   * Epoch ms when rest began. Passed in rather than read here: the clock is
   * captured in the event handler that starts the rest, which keeps this
   * component's render pure and makes the anchor survive re-renders.
   */
  startedAt: number
  seconds: number
  exerciseName: string
  /** The set the user is resting before. */
  nextSet: number
  /** From the prescription, when it names one ("3x10" → 3). */
  totalSets: number | null
  onDone: () => void
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

  const setLabel =
    totalSets && nextSet <= totalSets
      ? `Set ${nextSet} of ${totalSets}`
      : `Set ${nextSet}`

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
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

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="label-caps text-white/70">
          {done ? 'Rest complete' : 'Resting'}
        </p>
        <p className="mt-2 max-w-full truncate text-center text-[17px] font-semibold text-white">
          {exerciseName}
          <span className="text-white/60"> · {setLabel}</span>
        </p>

        {/*
         * The pulse is a transform (scale) on the ring's wrapper, so it stays on
         * the compositor; reduced motion gets the colour change alone.
         */}
        <m.div
          className="relative mt-12 flex aspect-square w-full max-w-[300px] items-center justify-center rounded-full bg-black/40 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          animate={
            done && !reduced ? { scale: [1, 1.05, 1, 1.05, 1] } : { scale: 1 }
          }
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          <svg
            viewBox="0 0 320 320"
            className="absolute inset-0 h-full w-full -rotate-90"
            aria-hidden
          >
            <circle
              cx="160"
              cy="160"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
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

          <div className="flex flex-col items-center">
            <p
              className="font-mono text-[76px] leading-none font-black tracking-tighter text-white tabular-nums"
              aria-live="polite"
            >
              {formatDuration(Math.ceil(remaining)).slice(3)}
            </p>
            <p
              className={`mt-3 text-[15px] font-semibold ${done ? 'text-success' : 'text-white/60'}`}
            >
              {done
                ? 'Ready when you are'
                : `of ${formatDuration(seconds).slice(3)}`}
            </p>
          </div>
        </m.div>

        <button
          type="button"
          onClick={onDone}
          className={`mt-auto flex h-16 w-full items-center justify-center gap-2 rounded-2xl border text-[18px] font-bold text-white transition-colors active:scale-[0.98] ${
            done
              ? 'border-success/50 bg-success/30'
              : 'border-white/15 bg-white/10'
          }`}
        >
          {done ? 'Next Set' : 'Skip Rest'}
          {done && <ChevronRightIcon className="h-5 w-5" />}
        </button>
      </div>
    </m.div>
  )
}
