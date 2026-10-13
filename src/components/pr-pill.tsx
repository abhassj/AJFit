'use client'

import { m, useReducedMotion } from 'framer-motion'

import { TrophyIcon } from '@/components/icons'
import { formatRecord, type PersonalRecord } from '@/lib/pr-types'
import type { WeightUnit } from '@/lib/units'

/**
 * The PR line beside an exercise: a violet pill with a trophy, so a record
 * reads as an achievement rather than a footnote. Without a record it stays
 * a muted "No PR yet", so the real ones stand out.
 *
 * Colours come from --color-pr (tint, border, glow) and --color-pr-text
 * (7.12:1 on the tint over a card). No backdrop blur.
 */
export function PrPill({
  record,
  unit,
  size = 'md',
  testId,
}: {
  record: PersonalRecord | undefined
  unit: WeightUnit
  size?: 'sm' | 'md'
  testId?: string
}) {
  if (!record) {
    return (
      <span
        data-testid={testId}
        className={`text-secondary ${size === 'sm' ? 'text-[12px]' : 'text-[13px]'}`}
      >
        No PR yet
      </span>
    )
  }
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border border-pr/60 bg-pr/[0.18] font-bold tracking-[0.08em] text-pr-text uppercase shadow-[0_0_14px_-3px_var(--color-pr)] ${
        size === 'sm'
          ? 'px-2 py-0.5 text-[10.5px]'
          : 'px-2.5 py-1 text-[11.5px]'
      }`}
    >
      <TrophyIcon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      PR {formatRecord(record, unit)}
    </span>
  )
}

/**
 * On the set that set a new record: the same family, filled stronger, with
 * one short pulse when it appears (a transform). Reduced motion: no pulse.
 */
export function NewPrBadge({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()
  return (
    <m.span
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { scale: [0.6, 1.15, 1], opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-flex items-center gap-1 rounded-full border border-pr bg-pr/[0.45] px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-primary uppercase shadow-[0_0_16px_-2px_var(--color-pr)] ${className}`}
    >
      <TrophyIcon className="h-3 w-3" />
      New PR
    </m.span>
  )
}
