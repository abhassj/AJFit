'use client'

import { useEffect } from 'react'

/**
 * Registers the shell service worker.
 *
 * Named Registrar rather than ServiceWorker because the latter is a DOM global
 * and shadowing it makes TypeScript resolve the interface instead of this
 * component.
 *
 * Renders nothing. It exists as a component only because registration needs the
 * browser, and this is the smallest client boundary that gets it without
 * turning a layout into a Client Component.
 *
 * Registration is deferred to the `load` event on purpose. Installing a worker
 * kicks off a batch of asset downloads, and doing that while the page is still
 * fetching what it needs to paint puts the two in direct competition — the
 * measurable cost lands on LCP, which Phase 6 spent real effort on. Waiting
 * costs nothing: the shell cache is for the *next* visit.
 *
 * Development is excluded. Next serves unhashed, frequently-changing assets from
 * a dev server, and a worker caching those is a reliable way to spend an
 * afternoon debugging a stale file.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // A failed registration must never surface to the user: the app works
        // identically without it, just without the warm shell cache.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
