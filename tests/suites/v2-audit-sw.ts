/**
 * Pre-push audit, item 5: the service worker cannot serve an old page.
 *
 * public/sw.js is loaded into a sandbox with a fake `self`, and fetch events
 * are dispatched at it. A request the worker answers calls respondWith; one it
 * leaves alone goes to the network exactly as if no worker were installed.
 * The worker must answer only content-hashed build output and the listed
 * static art — never a document, an RSC payload or a Server Action.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { suite } from '../lib/harness'

const ORIGIN = 'https://aj-fit.vercel.app'

type FetchHandler = (event: {
  request: {
    method: string
    url: string
    mode: string
    headers: Map<string, string>
  }
  respondWith: (r: unknown) => void
}) => void

function loadWorker(): FetchHandler {
  const handlers: Record<string, FetchHandler> = {}
  const sandbox = {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, fn: FetchHandler) => {
        handlers[type] = fn
      },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
    },
    caches: {
      match: () => Promise.resolve(undefined),
      open: () => Promise.resolve({ put: () => undefined }),
    },
    fetch: () => Promise.reject(new Error('network')),
    URL,
  }
  const src = readFileSync(
    path.resolve(__dirname, '../../public/sw.js'),
    'utf8',
  )
  vm.runInNewContext(src, sandbox)
  return handlers.fetch
}

/** Whether the worker would answer this request itself. */
function intercepted(
  fetchHandler: FetchHandler,
  pathAndQuery: string,
  init: {
    method?: string
    mode?: string
    headers?: Record<string, string>
  } = {},
): boolean {
  let answered = false
  fetchHandler({
    request: {
      method: init.method ?? 'GET',
      url: `${ORIGIN}${pathAndQuery}`,
      mode: init.mode ?? 'cors',
      headers: new Map(Object.entries(init.headers ?? {})),
    },
    respondWith: () => {
      answered = true
    },
  })
  return answered
}

export default suite('v2-audit-sw', {
  'documents (page navigations) always go to the network'() {
    const sw = loadWorker()
    for (const p of [
      '/',
      '/start',
      '/history/2026-09-07',
      '/profile',
      '/sign-in',
    ]) {
      assert.equal(intercepted(sw, p, { mode: 'navigate' }), false, p)
    }
  },

  'RSC payloads and prefetches always go to the network'() {
    const sw = loadWorker()
    assert.equal(
      intercepted(sw, '/start?_rsc=abc', { headers: { rsc: '1' } }),
      false,
    )
    assert.equal(
      intercepted(sw, '/program?_rsc=x', {
        headers: { rsc: '1', 'next-router-prefetch': '1' },
      }),
      false,
    )
  },

  'Server Action POSTs always go to the network'() {
    const sw = loadWorker()
    assert.equal(
      intercepted(sw, '/start', {
        method: 'POST',
        headers: { 'next-action': 'x' },
      }),
      false,
    )
  },

  'only hashed build output and listed static art are cache-first'() {
    const sw = loadWorker()
    assert.equal(intercepted(sw, '/_next/static/chunks/0abc123.js'), true)
    assert.equal(intercepted(sw, '/icon-192.png'), true)
    assert.equal(intercepted(sw, '/manifest.webmanifest'), false)
    assert.equal(intercepted(sw, '/sw.js'), false)
    assert.equal(intercepted(sw, '/_next/image?url=x'), false)
  },
})
