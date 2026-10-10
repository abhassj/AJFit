'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Result = { ok: true } | { ok: false; error: string }

type Job = { label: string; run: () => Promise<Result> }

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving'; pending: number }
  | { status: 'failed'; label: string; error: string; pending: number }

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
 * A thrown error — a dropped connection rejecting the Server Action's fetch —
 * is treated the same as a failed result.
 */
export function useWriteQueue() {
  const jobs = useRef<Job[]>([])
  const running = useRef(false)
  const halted = useRef(false)
  const idleWaiters = useRef<((ok: boolean) => void)[]>([])
  const [state, setState] = useState<SaveState>({ status: 'idle' })

  const settle = useCallback((ok: boolean) => {
    const waiters = idleWaiters.current
    idleWaiters.current = []
    for (const resolve of waiters) resolve(ok)
  }, [])

  const drain = useCallback(async () => {
    if (running.current || halted.current) return
    running.current = true
    try {
      while (jobs.current.length > 0) {
        const job = jobs.current[0]
        setState({ status: 'saving', pending: jobs.current.length })
        let result: Result
        try {
          result = await job.run()
        } catch {
          // A thrown action is a transport failure (the browser's raw
          // "Failed to fetch"), never a message worth showing as-is.
          result = {
            ok: false,
            error: 'No connection. Your entries are safe on this screen.',
          }
        }
        if (!result.ok) {
          halted.current = true
          setState({
            status: 'failed',
            label: job.label,
            error: result.error,
            pending: jobs.current.length,
          })
          settle(false)
          return
        }
        jobs.current.shift()
      }
      setState({ status: 'idle' })
      settle(true)
    } finally {
      running.current = false
    }
  }, [settle])

  const enqueue = useCallback(
    (label: string, run: () => Promise<Result>) => {
      jobs.current.push({ label, run })
      if (halted.current) {
        // Keep the count honest while the user decides to retry.
        setState((s) =>
          s.status === 'failed' ? { ...s, pending: jobs.current.length } : s,
        )
        return
      }
      void drain()
    },
    [drain],
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

  /*
   * Leaving with unsaved writes would lose them, so ask first. The browser
   * shows its own generic wording; the returnValue is required by some.
   */
  const hasPending = state.status !== 'idle'
  useEffect(() => {
    if (!hasPending) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasPending])

  return { state, enqueue, retry, flush }
}
