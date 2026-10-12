'use client'

import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'

import {
  OnboardingForm,
  type OnboardingInitial,
} from '@/components/onboarding-form'
import { BRAND } from '@/lib/brand'

/** Set for the rest of the browser session once "Later" is tapped. */
const LATER_KEY = 'ajfit-onboarding-later'

const noSubscription = () => () => {}

function readLater(): boolean {
  try {
    return window.sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    // No storage: the prompt simply shows, and Later still closes it.
    return false
  }
}

/**
 * For accounts that predate onboarding (decision D9): a dismissible prompt,
 * prefilled with what the profile already holds.
 *
 * Shown once per browser session until it is completed — "Later" hides it
 * until the app is next opened, never for good. It is mounted only while
 * onboarded_at is null, so finishing it (which revalidates the shell) is what
 * removes it. Never shown on /onboarding itself.
 */
export function OnboardingPrompt({ initial }: { initial: OnboardingInitial }) {
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const [closed, setClosed] = useState(false)
  /*
   * Read through useSyncExternalStore: sessionStorage does not exist during
   * the server render, so the server snapshot says "hidden" and the client
   * swaps in the real value right after hydration, with no mismatch.
   */
  const laterThisSession = useSyncExternalStore(
    noSubscription,
    readLater,
    () => true,
  )

  function later() {
    try {
      window.sessionStorage.setItem(LATER_KEY, '1')
    } catch {
      // Best effort; the prompt still closes for this page.
    }
    setClosed(true)
  }

  const visible = !laterThisSession && !closed && pathname !== '/onboarding'

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="my-auto w-full max-w-md rounded-2xl border border-hairline bg-card p-5 shadow-2xl"
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="label-caps">Welcome to {BRAND.name}</p>
            <h2
              id="onboarding-title"
              className="mt-1.5 text-xl font-bold tracking-tight text-primary"
            >
              Finish your profile
            </h2>
            <p className="mt-1 text-sm text-secondary">
              A few details so your weights, height and BMI read right.
            </p>
            <div className="mt-4">
              <OnboardingForm
                initial={initial}
                onDone={() => setClosed(true)}
                secondary={
                  <button
                    type="button"
                    onClick={later}
                    className="min-h-[48px] rounded-xl border border-hairline bg-card-raised text-sm font-semibold text-secondary"
                  >
                    Later
                  </button>
                }
              />
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
