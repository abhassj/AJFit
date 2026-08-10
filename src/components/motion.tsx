'use client'

import { LazyMotion, m, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Shared motion primitives.
 *
 * Everything here animates only `transform` and `opacity`. Those are the two
 * properties the compositor can handle without re-running layout or paint,
 * which is what keeps these at frame rate on a phone. Nothing animates width,
 * height, top or left.
 *
 * All of it collapses to a no-op when the user has asked for reduced motion.
 *
 * Bundle note: importing `motion` pulls Framer's whole feature set into the
 * initial bundle — measured at roughly +150KB, which showed up as a Lighthouse
 * regression. `LazyMotion` with `m` components loads those features in a
 * separate chunk after first paint instead. `strict` makes the full `motion.*`
 * components throw, so nothing can quietly reintroduce the eager bundle.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** domMax rather than domAnimation: the session and calendar swipes need drag. */
const loadFeatures = () => import('framer-motion').then((mod) => mod.domMax)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}

/** Staggered entrance for a list or grid of cards. */
export function StaggerList({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()

  const container: Variants = {
    hidden: {},
    show: {
      transition: reduced
        ? {}
        : { staggerChildren: 0.045, delayChildren: delay },
    },
  }

  return (
    <m.div
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {children}
    </m.div>
  )
}

/** One item inside a StaggerList. */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()

  const item: Variants = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE } },
      }

  return (
    <m.div className={className} variants={item}>
      {children}
    </m.div>
  )
}

/** Simple fade-and-rise, for a single element. */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()

  return (
    <m.div
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0 } : { duration: 0.34, ease: EASE, delay }
      }
    >
      {children}
    </m.div>
  )
}

/**
 * Page-level transition. Applied via the route group's template.tsx so it
 * re-runs on every navigation, which a layout would not.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  return (
    <m.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.26, ease: EASE }}
    >
      {children}
    </m.div>
  )
}
