'use client'

import { useEffect } from 'react'

/** Ask at most this often, however often the app is brought back. */
const MIN_INTERVAL_MS = 60_000

/**
 * Reloads a page left open across a deploy, when the app comes back to the
 * foreground.
 *
 * An installed iPhone app is suspended, not closed, when you switch away, and
 * resumes the very same document — so a page loaded before a deploy keeps
 * showing that build (this is how the old app name outlived the rename on a phone).
 * Next already hard-reloads on the next client navigation when the build
 * changed, but a user who reopens the app straight onto the Start screen may
 * never navigate. The shell (header, nav) also never re-renders on client
 * navigation. And the service worker cannot help: it never caches documents.
 *
 * So, on becoming visible, ask /version which deployment is live and compare
 * it with the one that rendered this page — passed in by the root layout, so a
 * document from an old deployment holds the old id. (Not read from
 * <html data-dpl-id>: Next deletes that attribute as soon as its client
 * starts.) If they differ,
 * reload. That is safe mid-workout: the logger keeps unsaved writes in
 * sessionStorage and replays them after a reload.
 *
 * Without a deployment id (local builds) there is nothing to compare, and
 * nothing happens.
 */
export function BuildCheck({ deploymentId }: { deploymentId: string | null }) {
  useEffect(() => {
    const current = deploymentId
    if (!current) return
    let lastAsked = Date.now()

    const check = async () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastAsked < MIN_INTERVAL_MS) return
      lastAsked = Date.now()
      try {
        const res = await fetch('/version', { cache: 'no-store' })
        if (!res.ok) return
        const { deploymentId } = (await res.json()) as {
          deploymentId: string | null
        }
        if (deploymentId && deploymentId !== current) {
          window.location.reload()
        }
      } catch {
        // Offline or the request failed: try again next time.
      }
    }

    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [deploymentId])

  return null
}
