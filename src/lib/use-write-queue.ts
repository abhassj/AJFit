'use client'

import { unstable_isUnrecognizedActionError } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type Result = { ok: true } | { ok: false; error: string }

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving'; pending: number }
  | { status: 'failed'; label: string; error: string; pending: number }

/** A reload this recent that did not cure a stale build will not be repeated. */
const RELOAD_GUARD_MS = 60_000

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): boolean {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
    return true
  } catch {
    // Private mode or storage disabled. The queue still works in memory; only
    // the survive-a-reload guarantee is lost, and the stale-build path below
    // refuses to reload rather than lose anything.
    return false
  }
}

/**
 * Saves in the background, strictly in order, and never silently.
 *
 * The session runner applies every tap to its own state first, so the screen
 * answers instantly regardless of the network. The matching server writes go
 * through here:
 *
 *   - One at a time, in the order they were made. "Log set 3" can never land
 *     before "log set 2", and a status change never overtakes the sets it
 *     closes out.
 *   - A failed write stops the queue rather than skipping ahead, so nothing
 *     behind it is written on top of a gap. The failure is surfaced with a
 *     Retry, and retrying resumes from exactly that write.
 *   - Writes are idempotent (client-generated ids, plain updates), so a retry
 *     after a save that actually reached the server does no harm.
 *
 * Everything unsaved is mirrored to sessionStorage under `storageKey`, so a
 * reload — deliberate or not — cannot lose it; the owner replays it with
 * restore().
 *
 * A stale build is handled on its own. When a deploy lands mid-session, this
 * page's Server Action ids no longer exist on the server and every save fails
 * with Next's UnrecognizedActionError, which no Retry can cure. The queue then
 * stores what is unsaved and reloads onto the new build, where the owner
 * replays it. If a reload already happened within the last minute and the
 * build still rejects the call, it stops and shows the failure instead of
 * reloading in a loop — the entries stay stored either way.
 */
export function useWriteQueue<T>({
  storageKey,
  run,
  label,
}: {
  storageKey: string
  run: (job: T) => Promise<Result>
  label: (job: T) => string
}) {
  const jobs = useRef<T[]>([])
  const running = useRef(false)
  const halted = useRef(false)
  const idleWaiters = useRef<((ok: boolean) => void)[]>([])
  const [state, setState] = useState<SaveState>({ status: 'idle' })

  const reloadKey = `${storageKey}:reloaded-at`

  const persist = useCallback(() => {
    return writeStorage(
      storageKey,
      jobs.current.length > 0 ? JSON.stringify(jobs.current) : null,
    )
  }, [storageKey])

  const settle = useCallback((ok: boolean) => {
    const waiters = idleWaiters.current
    idleWaiters.current = []
    for (const resolve of waiters) resolve(ok)
  }, [])

  const fail = useCallback(
    (job: T, error: string) => {
      halted.current = true
      setState({
        status: 'failed',
        label: label(job),
        error,
        pending: jobs.current.length,
      })
      settle(false)
    },
    [label, settle],
  )

  const drain = useCallback(async () => {
    if (running.current || halted.current) return
    running.current = true
    try {
      while (jobs.current.length > 0) {
        const job = jobs.current[0]
        setState({ status: 'saving', pending: jobs.current.length })
        let result: Result
        try {
          result = await run(job)
        } catch (e) {
          if (unstable_isUnrecognizedActionError(e)) {
            const stored = persist()
            const last = Number(readStorage(reloadKey) ?? 0)
            if (stored && Date.now() - last > RELOAD_GUARD_MS) {
              writeStorage(reloadKey, String(Date.now()))
              halted.current = true
              window.location.reload()
              return
            }
            fail(
              job,
              stored
                ? 'The app was updated and still can’t save. Your entries are kept on this device — reload the app, then they’ll be saved.'
                : 'The app was updated. Don’t close this screen; reload when your connection is steady.',
            )
            return
          }
          // Any other thrown action is a transport failure (the browser's raw
          // "Failed to fetch"), never a message worth showing as-is.
          result = {
            ok: false,
            error: 'No connection. Your entries are safe on this screen.',
          }
        }
        if (!result.ok) {
          fail(job, result.error)
          return
        }
        jobs.current.shift()
        persist()
      }
      setState({ status: 'idle' })
      settle(true)
    } finally {
      running.current = false
    }
  }, [fail, persist, reloadKey, run, settle])

  const enqueue = useCallback(
    (...newJobs: T[]) => {
      jobs.current.push(...newJobs)
      persist()
      if (halted.current) {
        // Keep the count honest while the user decides to retry.
        setState((s) =>
          s.status === 'failed' ? { ...s, pending: jobs.current.length } : s,
        )
        return
      }
      void drain()
    },
    [drain, persist],
  )

  const retry = useCallback(() => {
    halted.current = false
    void drain()
  }, [drain])

  /** Resolves true once every queued write has saved, false if one failed. */
  const flush = useCallback((): Promise<boolean> => {
    if (jobs.current.length === 0 && !running.current) {
      return Promise.resolve(!halted.current)
    }
    if (halted.current) return Promise.resolve(false)
    return new Promise((resolve) => idleWaiters.current.push(resolve))
  }, [])

  /**
   * Unsaved jobs left by a previous page load of this same screen, oldest
   * first. They stay stored until they save; the caller re-applies them to its
   * state and passes them back to enqueue().
   */
  const restore = useCallback((): T[] => {
    const raw = readStorage(storageKey)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }, [storageKey])

  /*
   * Leaving with unsaved writes would lose them from this screen (they stay in
   * sessionStorage for a reload, but not for a closed tab), so ask first. The
   * browser shows its own generic wording; the returnValue is required by some.
   */
  const hasPending = state.status !== 'idle'
  useEffect(() => {
    if (!hasPending) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // The stale-build reload is deliberate; don't prompt for it.
      if (halted.current && state.status !== 'failed') return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasPending, state.status])

  return { state, enqueue, retry, flush, restore }
}
