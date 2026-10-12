'use client'

import { animate, AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { ChevronRightIcon } from '@/components/icons'
import {
  BMI_EDGES,
  BMI_NOTE,
  BMI_SCALE,
  bmiGaugePosition,
  computeBmi,
  type BmiBand,
} from '@/lib/bmi'

const BAND_COLOUR: Record<BmiBand, string> = {
  under: 'var(--color-secondary)',
  healthy: 'var(--color-success)',
  over: 'var(--color-primary)',
  obese: 'var(--color-danger)',
}

const CX = 150
const CY = 150
const R = 118

/** A point on the upper semicircle at position t (0 = left, 1 = right). */
function point(t: number) {
  const a = Math.PI * t
  return { x: CX - R * Math.cos(a), y: CY - R * Math.sin(a) }
}

function arc(from: number, to: number) {
  const a = point(bmiGaugePosition(from))
  const b = point(bmiGaugePosition(to))
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`
}

const BANDS: { band: BmiBand; from: number; to: number }[] = [
  { band: 'under', from: BMI_SCALE.min, to: BMI_EDGES.healthy },
  { band: 'healthy', from: BMI_EDGES.healthy, to: BMI_EDGES.over },
  { band: 'over', from: BMI_EDGES.over, to: BMI_EDGES.obese },
  { band: 'obese', from: BMI_EDGES.obese, to: BMI_SCALE.max },
]

/**
 * The Profile row that opens the BMI result.
 *
 * Computed from the latest bodyweight entry and the stored height, both
 * metric, whatever units the user reads. With either missing it asks for it
 * instead of opening.
 */
export function BmiRow({
  weightKg,
  heightCm,
}: {
  weightKg: number | null
  heightCm: number | null
}) {
  const [open, setOpen] = useState(false)
  const result = computeBmi(weightKg, heightCm)

  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-primary">BMI</span>
      <span className="block text-[13px] text-secondary">
        {result
          ? 'See your body mass index'
          : !heightCm
            ? 'Add your height below to see it'
            : 'Log your weight below to see it'}
      </span>
    </span>
  )

  return (
    <>
      {/* Only a button when there is something to open. */}
      {result ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="surface flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-5 py-3 text-left"
        >
          {text}
          <ChevronRightIcon className="h-4 w-4 text-faint" />
        </button>
      ) : (
        <div className="surface flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-5 py-3">
          {text}
        </div>
      )}
      <AnimatePresence>
        {open && result && (
          <BmiDialog
            value={result.value}
            band={result.band}
            label={result.label}
            comment={result.comment}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * The result, revealed in three beats over about 2.5 seconds: the needle
 * sweeps to the value, the number counts up with it, then the band and its
 * note fade in. Only transform (the needle's rotation) and opacity animate;
 * the count-up is a text update. Reduced motion shows the final state at once.
 */
function BmiDialog({
  value,
  band,
  label,
  comment,
  onClose,
}: {
  value: number
  band: BmiBand
  label: string
  comment: string
  onClose: () => void
}) {
  const reduced = useReducedMotion()
  const [counted, setCounted] = useState<number>(BMI_SCALE.min)
  /*
   * useReducedMotion() is null on the first render and only then settles, so
   * the starting state cannot depend on it. Under reduced motion the final
   * value is simply shown instead of the count.
   */
  const shown = reduced ? value : counted
  const angle = (bmiGaugePosition(value) - 0.5) * 180

  useEffect(() => {
    if (reduced) return
    const controls = animate(BMI_SCALE.min, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setCounted(v),
    })
    return () => controls.stop()
  }, [reduced, value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <m.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      onClick={onClose}
    >
      <m.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bmi-title"
        className="w-full max-w-sm rounded-2xl border border-hairline bg-card p-6 shadow-2xl"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: 24 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        data-testid="bmi-dialog"
      >
        <h2 id="bmi-title" className="label-caps text-center">
          Body Mass Index
        </h2>

        <div className="relative mx-auto mt-4 aspect-[2/1] w-full max-w-[300px]">
          <svg viewBox="0 0 300 160" className="h-full w-full" aria-hidden>
            {BANDS.map((b) => (
              <path
                key={b.band}
                d={arc(b.from, b.to)}
                fill="none"
                stroke={BAND_COLOUR[b.band]}
                strokeOpacity={b.band === band ? 0.95 : 0.3}
                strokeWidth="16"
              />
            ))}
          </svg>
          {/* The needle: rotated about its base at the gauge's centre. */}
          <m.div
            className="absolute bottom-[6.25%] left-1/2 h-[72%] w-[3px] -translate-x-1/2 rounded-full bg-primary"
            style={{ transformOrigin: '50% 100%' }}
            initial={{ rotate: reduced ? angle : -90 }}
            animate={{ rotate: angle }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 1.6, ease: [0.22, 1, 0.36, 1] }
            }
          />
          <span className="absolute bottom-[3%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-primary" />
        </div>

        <p
          className="mt-3 text-center font-mono text-[44px] leading-none font-black text-primary tabular-nums"
          data-testid="bmi-value"
          aria-live="polite"
        >
          {shown.toFixed(1)}
        </p>

        <m.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 1.7, duration: 0.6 }}
        >
          <p
            className="mt-3 text-center text-[15px] font-semibold"
            style={{ color: BAND_COLOUR[band] }}
            data-testid="bmi-band"
            data-band={band}
          >
            {label}
          </p>
          <p className="mt-2 text-center text-sm leading-relaxed text-secondary">
            {comment}
          </p>
          <p className="mt-3 text-center text-[12px] leading-relaxed text-faint">
            {BMI_NOTE}
          </p>
        </m.div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[48px] w-full rounded-xl border border-hairline bg-card-raised text-sm font-semibold text-primary"
        >
          Close
        </button>
      </m.div>
    </m.div>
  )
}
