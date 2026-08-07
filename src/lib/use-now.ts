'use client'

import { useSyncExternalStore } from 'react'

/**
 * The wall clock as an external store.
 *
 * The clock is mutable state outside React, so `useSyncExternalStore` is the
 * right subscription primitive: reading `Date.now()` during render is impure,
 * and driving it from `setState` inside an effect causes cascading renders.
 *
 * The snapshot is cached in a module-level value that only the interval
 * updates, so repeated `getSnapshot()` calls within one render are stable.
 * The server snapshot is 0 so SSR and first client paint agree; React re-reads
 * the snapshot immediately after subscribing, which fills in the real time.
 */
let cachedNow = 0

function subscribe(onStoreChange: () => void) {
  cachedNow = Date.now()
  const id = setInterval(() => {
    cachedNow = Date.now()
    onStoreChange()
  }, 1000)
  return () => clearInterval(id)
}

const getSnapshot = () => cachedNow
const getServerSnapshot = () => 0

/** Milliseconds since epoch, refreshed once a second. 0 until mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
