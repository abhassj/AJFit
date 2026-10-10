/**
 * Measures the Start screen's tap path in a real browser at phone size.
 *
 * For each interaction it records:
 *   visualMs   click → the DOM showing the result (what the user feels)
 *   upstream   Supabase requests the server made because of that tap
 *   settledMs  click → the last of those requests finishing
 *
 * Run against a production build whose Supabase URL is the latency proxy:
 *
 *   LATENCY_MS=200 npx tsx tests/perf/latency-proxy.ts            (terminal 1)
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 \
 *     NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon> npm run build \
 *     && npx next start -p 3100                                   (terminal 2)
 *   APP_URL=http://localhost:3100 npx tsx tests/perf/measure-start.ts
 *
 * Local stack only: the seed user is created through tests/lib/local.
 */
import { chromium, type Page } from '@playwright/test'

import {
  deleteTestUsers,
  newUser,
  seedProgram,
  TEST_PASSWORD,
} from '../lib/local'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3100'
const PROXY_URL = process.env.PROXY_URL ?? 'http://127.0.0.1:54399'
const RUNS = Number(process.env.RUNS ?? 3)

type Sample = {
  action: string
  visualMs: number
  upstream: number
  settledMs: number
}

async function proxyStats(): Promise<{
  total: number
  byPath: Record<string, number>
}> {
  const res = await fetch(`${PROXY_URL}/__stats`)
  return res.json()
}

async function proxyTotal(): Promise<number> {
  return (await proxyStats()).total
}

/** Requests per endpoint between two stats snapshots. */
function diffPaths(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(b)) {
    const d = v - (a[k] ?? 0)
    if (d > 0) out[k] = d
  }
  return out
}

const breakdowns: Record<string, Record<string, number>> = {}

/** Waits until the proxy has seen no new requests for `quietMs`. */
async function settle(quietMs = 1200): Promise<number> {
  let last = await proxyTotal()
  let lastChange = Date.now()
  for (;;) {
    await new Promise((r) => setTimeout(r, 100))
    const now = await proxyTotal()
    if (now !== last) {
      last = now
      lastChange = Date.now()
    } else if (Date.now() - lastChange >= quietMs) {
      return lastChange
    }
  }
}

/** Clicks the button with `label` and resolves when `expectText` is on screen. */
async function timedClick(
  page: Page,
  action: string,
  label: string,
  expectText: string,
): Promise<Sample> {
  await settle()
  const beforeStats = await proxyStats()
  const before = beforeStats.total
  const clickedAt = Date.now()
  // Passed as source text: tsx's keepNames helper (__name) does not exist in
  // the page, so a compiled function literal would throw there.
  const visualMs: number = await page.evaluate(`
    new Promise((resolve, reject) => {
      const label = ${JSON.stringify(label)}
      const expectText = ${JSON.stringify(expectText)}
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label && !b.disabled,
      )
      if (!button) return reject(new Error('No button ' + label))
      const t0 = performance.now()
      const observer = new MutationObserver(() => {
        if (document.body.textContent.includes(expectText)) {
          observer.disconnect()
          resolve(performance.now() - t0)
        }
      })
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      })
      button.click()
      setTimeout(() => reject(new Error('Timed out on ' + label)), 20000)
    })
  `)
  const lastRequestAt = await settle()
  const afterStats = await proxyStats()
  const upstream = afterStats.total - before
  breakdowns[action] = diffPaths(beforeStats.byPath, afterStats.byPath)
  return {
    action,
    visualMs: Math.round(visualMs),
    upstream,
    settledMs:
      upstream === 0 ? Math.round(visualMs) : lastRequestAt - clickedAt,
  }
}

async function press(page: Page, keys: string) {
  for (const k of keys) {
    await page.getByRole('button', { name: k, exact: true }).click()
  }
}

async function main() {
  const user = await newUser('perf')
  const names = [
    ['Lat Pulldown', 'Barbell Bicep Curl', 'Dumbbell Hammer Curl'],
    [
      'Barbell Bench Press',
      'Tricep Rope Pushdown',
      'Cable Chest Flye / Crossover',
    ],
  ]
  const days = Object.fromEntries(
    [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ].map((dow, i) => [
      dow,
      { title: `Day ${i + 1}`, exercises: names[i % 2] },
    ]),
  )
  await seedProgram(user, { days })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Asia/Kolkata',
  })
  await context.addCookies([
    { name: 'ajfit-tz', value: 'Asia%2FKolkata', url: APP_URL },
  ])
  const page = await context.newPage()

  const samples: Sample[] = []
  try {
    await page.goto(`${APP_URL}/sign-in`)
    await page.fill('input[name=email]', user.email)
    await page.fill('input[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL(`${APP_URL}/`)

    await page.goto(`${APP_URL}/start`)
    await page.getByRole('button', { name: 'Start Workout' }).click()
    samples.push(
      await timedClick(
        page,
        'start session',
        'Confirm Start',
        'Logging Session',
      ),
    )

    for (let i = 1; i <= RUNS; i++) {
      await press(page, String(8 + i))
      await page.getByRole('button', { name: /^Weight/ }).click()
      await press(page, String(40 + i))
      samples.push(
        await timedClick(
          page,
          'log set',
          'Log Set',
          `${8 + i} reps × ${40 + i}`,
        ),
      )
    }

    samples.push(
      await timedClick(page, 'mark complete', 'Mark Complete', 'Completed at'),
    )
    samples.push(
      await timedClick(page, 'skip exercise', 'Skip Exercise', 'Skipped at'),
    )
    samples.push(await timedClick(page, 'finish', 'Finish', 'Workout Complete'))
  } finally {
    await browser.close()
    deleteTestUsers()
  }

  console.table(samples)
  console.log(JSON.stringify(breakdowns, null, 1))
  console.log(JSON.stringify(samples))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
