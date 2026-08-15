/**
 * AJFit service worker — app shell only.
 *
 * ============================================================================
 * WHAT THIS DOES NOT DO
 * ============================================================================
 * It does not cache a single byte of workout data. No Supabase request is
 * intercepted, stored, or replayed, and nothing is queued for later delivery.
 *
 * That is a deliberate product decision, not an unfinished feature. A fitness
 * app that appears to accept a logged set while offline, and then loses it —
 * or worse, replays it hours later against a session that has since been
 * finished — is more harmful than one that plainly says it needs a connection.
 * Sets, sessions, programs and profiles are all live reads and writes against
 * the network, exactly as they are without a service worker installed.
 *
 * What it does cache is the shell: the icons, the background artwork and the
 * category illustrations. Those are large, immutable, and the difference
 * between an installed app that opens instantly and one that shows a dark
 * rectangle for two seconds on gym wifi.
 * ============================================================================
 */

// Bump this to invalidate everything: old caches are dropped on activate.
const CACHE = 'ajfit-shell-v1'

/**
 * Static art, precached on install.
 *
 * Only files that are genuinely part of the chrome. They are served from
 * /public unhashed, so a redeploy that changes one needs a CACHE bump — which
 * is why the list is short and stable rather than exhaustive.
 */
const SHELL = [
  '/fluid_bg.png',
  '/rest_bg.png',
  '/category_chest.png',
  '/category_back.png',
  '/category_legs.png',
  '/category_shoulders.png',
  '/category_arms.png',
  '/category_abs.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll is all-or-nothing: one 404 would abandon the whole install and
      // leave the app with no shell cache at all. Each file is added on its own
      // so a single missing asset costs only that asset.
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            cache.add(url).catch(() => {
              /* asset missing or offline at install time; skip it */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/**
 * Only same-origin GETs for static art are eligible. Everything else — every
 * Supabase call, every Server Action POST, every RSC navigation — falls through
 * untouched to the network.
 */
function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false
  // Next's build output is content-hashed and immutable, so it is safe and
  // worthwhile; /api and RSC payloads never are.
  if (url.pathname.startsWith('/_next/static/')) return true
  return SHELL.includes(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (!isShellAsset(url)) return

  /*
   * Cache-first, because everything reaching this point is immutable: hashed
   * build output, or artwork whose change is signalled by a CACHE bump. A
   * network-first strategy here would pay a round trip for a file that cannot
   * have changed.
   *
   * A miss still goes to the network and the response is stored for next time,
   * so an illustration the user has not opened yet is cached the first time
   * they do rather than never.
   */
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => {
          // Offline and not cached. Returning undefined lets the browser show
          // its own failure for the asset rather than the app inventing one.
          return undefined
        })
    }),
  )
})
