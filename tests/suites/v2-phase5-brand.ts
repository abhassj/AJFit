/**
 * V2 Phase 5.3 — the Ezlyfts rename, checked statically: no user-facing
 * "AJFit" left in code, the manifest and icons, and a bumped service-worker
 * cache so installed apps drop the old art.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import {
  APP_URL,
  closeBrowser,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { suite } from '../lib/harness'
import { newUser, seedProgram } from '../lib/local'
import manifest from '@/app/manifest'
import { BRAND } from '@/lib/brand'

const root = path.resolve(__dirname, '../..')

/**
 * Where "AJFit" may still appear, and why. Everything else under src/ and
 * public/ must be clean.
 *   - ajfit-* cookie and storage keys: infrastructure (D12); renaming them
 *     would sign everyone's timezone and pending writes out of existence.
 *   - docs/AJFit_*.md references in comments: the files keep their names.
 *   - the service worker's note on why the cache was bumped.
 *   - brand.ts's comment recording the rename.
 */
const ALLOWED = [
  /'ajfit-tz'/,
  /'ajfit-onboarding-later'/,
  /`ajfit-pending-writes:/,
  // Added in Batch D: the stored rest period, same key namespace (D12).
  /'ajfit-rest'/,
  /docs\/AJFit_[A-Za-z_]+\.md/,
  /keep serving the old AJFit art/,
  // brand.ts's own comment explaining the rename and what was kept.
  /AJFit is now Ezlyfts/,
  /the `ajfit-\*` cookie and cache keys/,
]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return files(full)
    // .svg included: a wordmark drawn as SVG text would otherwise slip past.
    return /\.(tsx?|js|mjs|css|json|webmanifest|svg)$/.test(name) ? [full] : []
  })
}

export default suite('v2-phase5-brand', {
  'no user-facing AJFit / AJ Fit left in src or public'() {
    const offenders: string[] = []
    for (const file of [
      ...files(path.join(root, 'src')),
      ...files(path.join(root, 'public')),
    ]) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!/aj ?fit/i.test(line)) return
          if (ALLOWED.some((ok) => ok.test(line))) return
          offenders.push(
            `${path.relative(root, file)}:${i + 1}: ${line.trim()}`,
          )
        })
    }
    assert.deepEqual(offenders, [])
  },

  'brand constants and the manifest say Ezlyfts / Ez'() {
    // CHANGED in Batch D: BRAND also carries the auth tagline now, so the
    // identity fields are compared on their own. Previously:
    //   assert.deepEqual(BRAND, { name: 'Ezlyfts', shortName: 'Ezlyfts', monogram: 'Ez' })
    assert.deepEqual(
      {
        name: BRAND.name,
        shortName: BRAND.shortName,
        monogram: BRAND.monogram,
      },
      { name: 'Ezlyfts', shortName: 'Ezlyfts', monogram: 'Ez' },
    )
    const m = manifest()
    assert.equal(m.name, 'Ezlyfts')
    assert.equal(m.short_name, 'Ezlyfts')
  },

  'the service worker cache moved past v1'() {
    const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8')
    const version = sw.match(/const CACHE = '([a-z]+)-shell-v(\d+)'/)
    assert.ok(version, 'CACHE constant not found')
    assert.equal(version[1], 'ezlyfts')
    assert.ok(Number(version[2]) >= 2)
  },

  async 'every icon exists at its declared size and shape'() {
    const expected: [string, number, boolean][] = [
      ['public/icon-192.png', 192, true],
      ['public/icon-512.png', 512, true],
      ['public/icon-192-maskable.png', 192, false],
      ['public/icon-512-maskable.png', 512, false],
      ['public/apple-touch-icon.png', 180, false],
    ]
    for (const [file, size, alpha] of expected) {
      const meta = await sharp(path.join(root, file)).metadata()
      assert.equal(meta.width, size, file)
      assert.equal(meta.height, size, file)
      // Maskable and iOS icons must be full-bleed, with no transparency.
      assert.equal(!!meta.hasAlpha, alpha, `${file} alpha`)
    }
    const ico = readFileSync(path.join(root, 'src/app/favicon.ico'))
    assert.equal(ico.readUInt16LE(2), 1, 'favicon is not an ICO')
    assert.equal(ico.readUInt16LE(4), 4, 'favicon should carry 4 sizes')
  },
  async 'no rendered AJFit: text, title, alt/aria/title/placeholder, SVG text'() {
    // Batch D item 0: an iPhone showed "AJFIT" in the Start header. The source
    // grep above passed, so this checks what screens actually render — every
    // text node, every accessible label and every inline SVG text — on each
    // screen, including Start during a live session.
    const user = await newUser('brandrender')
    await seedProgram(user, {
      days: Object.fromEntries(
        [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ].map((d) => [d, { title: 'Pull', exercises: ['Lat Pulldown'] }]),
      ),
    })
    const ctx = await phoneContext()
    const page = await ctx.newPage()
    const offenders: string[] = []
    const sweep = async (where: string) => {
      const found = (await page.evaluate(`(() => {
        const out = []
        // The test accounts' own email domain (ajfit.test) is test data,
        // not branding, so it is blanked out before matching.
        const hit = (s) => s && /aj ?fit/i.test(s.replace(/@ajfit\.test/gi, ''))
        if (hit(document.title)) out.push('title: ' + document.title)
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          // Script and style text is never shown (it holds the RSC payload).
          const tag = walker.currentNode.parentElement?.tagName
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue
          const t = walker.currentNode.textContent
          if (hit(t)) out.push('text: ' + t.trim().slice(0, 80))
        }
        for (const el of document.querySelectorAll('[alt],[aria-label],[title],[placeholder]')) {
          for (const a of ['alt', 'aria-label', 'title', 'placeholder']) {
            const v = el.getAttribute(a)
            if (hit(v)) out.push(a + ': ' + v)
          }
        }
        for (const el of document.querySelectorAll('svg text, svg title, svg desc')) {
          if (hit(el.textContent)) out.push('svg: ' + el.textContent)
        }
        return out
      })()`)) as string[]
      for (const f of found) offenders.push(`${where} → ${f}`)
    }
    try {
      for (const p of ['/sign-in', '/sign-up']) {
        await page.goto(`${APP_URL}${p}`)
        await sweep(p)
      }
      await signIn(page, user)
      for (const p of [
        '/',
        '/start',
        '/program',
        '/workouts',
        '/profile',
        '/profile/prs',
      ]) {
        await page.goto(`${APP_URL}${p}`)
        await page.waitForLoadState('networkidle')
        await sweep(p)
      }
      await startTodaysWorkout(page)
      await sweep('/start (live session)')
    } finally {
      await ctx.close()
      await closeBrowser()
    }
    assert.deepEqual(offenders, [], offenders.join(' | '))
  },

  async '/version is public JSON that nothing may cache'() {
    // BuildCheck asks this from any page, signed in or not; the proxy must
    // not bounce it to /sign-in, and no cache (browser, CDN, service worker)
    // may hold an old answer. No cookies on these requests.
    const res = await fetch(`${APP_URL}/version`, { redirect: 'manual' })
    assert.equal(
      res.status,
      200,
      `status ${res.status} ${res.headers.get('location') ?? ''}`,
    )
    assert.match(res.headers.get('content-type') ?? '', /^application\/json/)
    const cc = res.headers.get('cache-control') ?? ''
    assert.match(cc, /\bno-store\b/, `cache-control: ${cc}`)
    assert.doesNotMatch(cc, /\b(public|s-maxage|immutable)\b/, cc)
    const body = (await res.json()) as { deploymentId: string | null }
    assert.equal(typeof body.deploymentId, 'string')
    // A path the proxy does guard still redirects when signed out, so the
    // exclusion above is specific to /version.
    const guarded = await fetch(`${APP_URL}/start`, { redirect: 'manual' })
    assert.ok(
      [302, 303, 307, 308].includes(guarded.status),
      `/start signed out: ${guarded.status}`,
    )
    assert.match(guarded.headers.get('location') ?? '', /\/sign-in/)
    // The service worker never answers /version (it only serves static assets).
    const sw = await (await fetch(`${APP_URL}/sw.js`)).text()
    assert.ok(!sw.includes('/version'), 'sw.js mentions /version')
  },

  async 'a page left open across a deploy reloads when the app comes back'() {
    // BuildCheck: <html data-dpl-id> is the build the page came from; /version
    // says which is live. Pretend a deploy happened, bring the app back to the
    // foreground, and expect a fresh load.
    const ctx = await phoneContext()
    const page = await ctx.newPage()
    try {
      await page.goto(`${APP_URL}/sign-in`)
      // The id Next stamped on the served HTML (its client deletes the
      // attribute on start, so read the raw response, not the DOM).
      const html = await (await page.request.get(`${APP_URL}/sign-in`)).text()
      const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1]
      assert.ok(
        dpl,
        'this build has no deployment id — build with VERCEL_GIT_COMMIT_SHA set',
      )
      const live = (await (
        await page.request.get(`${APP_URL}/version`)
      ).json()) as { deploymentId: string }
      assert.equal(
        live.deploymentId,
        dpl,
        '/version must report the page’s own build',
      )

      await page.route('**/version', (route) =>
        route.fulfill({ json: { deploymentId: 'newer-deploy' } }),
      )
      let loads = 0
      page.on('load', () => loads++)
      // Let the 60s throttle pass, then "return" to the app.
      await page.clock.install()
      await page.clock.fastForward(61_000)
      await page.evaluate(
        `document.dispatchEvent(new Event('visibilitychange'))`,
      )
      await page.waitForEvent('load', { timeout: 10_000 })
      assert.equal(loads, 1)
    } finally {
      await ctx.close()
      await closeBrowser()
    }
  },
})
