'use client'

import { m, useReducedMotion } from 'framer-motion'

import { HazardIcon } from '@/components/icons'
import { BRAND } from '@/lib/brand'

/**
 * The hazard-sign tagline above the sign-in and sign-up forms. Copy lives in
 * BRAND.tagline.
 *
 * A near-opaque base panel (not a blur) keeps every line readable over the
 * auth backdrop art: the amber chip text is 8.12:1 on its tint, the headline
 * 17:1, the sub-line well above 4.5:1. The left edge is a thin diagonal
 * hazard stripe drawn in CSS. Entrance: fade and an 8px rise over 350ms —
 * transform and opacity only, so the form below never shifts — and instant
 * under reduced motion.
 */
export function AuthTagline() {
  const reduced = useReducedMotion()
  const { label, headline, sub } = BRAND.tagline
  return (
    <m.section
      aria-label={`${label}: ${headline}`}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-5 overflow-hidden rounded-xl border border-hazard/35 bg-base/90 py-3.5 pr-4 pl-6 text-left"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-2"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, var(--color-hazard) 0 5px, transparent 5px 10px)',
          opacity: 0.85,
        }}
      />
      <span className="inline-flex items-center gap-1.5 rounded-md border border-hazard/50 bg-hazard/[0.12] px-2 py-0.5 text-[10.5px] font-bold tracking-[0.18em] text-hazard uppercase">
        <HazardIcon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-2 text-[17px] leading-snug font-black tracking-[0.02em] text-primary">
        {headline}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-primary/80">{sub}</p>
    </m.section>
  )
}
