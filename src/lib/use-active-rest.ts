'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * The rest period in progress, kept in sessionStorage so it survives a reload.
 *
 * BuildCheck reloads a page left open across a deploy the moment the app comes
 * back to the foreground — which is exactly what happens when the phone was
 * locked mid-rest. The countdown is timestamp-based (see RestTimer), so all a
 * reload needs to restore it is when rest began: the overlay comes back with
 * the right time remaining, or as "Rest complete" if it ran out while away.
 *
 * Keyed by session exercise, so it only ever reopens on the exercise it was
 * started for, and cleared when rest is closed. sessionStorage is per tab and
 * dies with it. Without storage (private mode) it still works in memory; only
 * the survive-a-reload part is lost.
 */
const KEY = 'ajfit-rest'

export type ActiveRest = {
  /** Epoch ms when rest began. */
  startedAt: number
  /** The set that started it beat the record. */
  newRecord: boolean
}

type Stored = ActiveRest & { exerciseId: string }

let memory: string | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function write(value: string | null) {
  memory = value
  try {
    if (value === null) window.sessionStorage.removeItem(KEY)
    else window.sessionStorage.setItem(KEY, value)
  } catch {
    // Kept in memory above.
  }
  listeners.forEach((l) => l())
}

function parse(raw: string | null): Stored | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<Stored>
    return typeof v.exerciseId === 'string' &&
      typeof v.startedAt === 'number' &&
      Number.isFinite(v.startedAt)
      ? {
          exerciseId: v.exerciseId,
          startedAt: v.startedAt,
          newRecord: v.newRecord === true,
        }
      : null
  } catch {
    return null
  }
}

/**
 * The active rest for one session exercise, and a setter (null closes it).
 * Read through useSyncExternalStore: the server snapshot is "no rest", and the
 * client swaps in the stored one right after hydration, with no mismatch.
 */
export function useActiveRest(
  exerciseId: string,
): [ActiveRest | null, (rest: ActiveRest | null) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null)
  const rest = useMemo(() => {
    const stored = parse(raw)
    return stored && stored.exerciseId === exerciseId
      ? { startedAt: stored.startedAt, newRecord: stored.newRecord }
      : null
  }, [raw, exerciseId])
  const set = useMemo(
    () => (next: ActiveRest | null) =>
      write(next === null ? null : JSON.stringify({ exerciseId, ...next })),
    [exerciseId],
  )
  return [rest, set]
}
