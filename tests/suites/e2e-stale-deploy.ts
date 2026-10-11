/**
 * Stale deploys mid-workout (Batch B item 4).
 *
 * After a deploy, the open page's Server Action ids no longer exist and every
 * save is answered 404 "Server action not found" (Next sets
 * x-nextjs-action-not-found). The runner must keep what is unsaved, reload
 * onto the new build, and replay it in order — and if the reload does not
 * cure it, stop and say so rather than loop or drop anything.
 *
 * The stale build is simulated by answering the runner's action POSTs exactly
 * as the server does for an unknown id.
 */
import assert from 'node:assert/strict'

import type { Page, Route } from '@playwright/test'

import {
  closeBrowser,
  keypad,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { suite } from '../lib/harness'
import { newUser, seedProgram, sql, type TestUser } from '../lib/local'

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

async function userWithSplit(tag: string): Promise<TestUser> {
  const user = await newUser(tag)
  await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        { title: 'Arms', exercises: ['Barbell Bicep Curl'] },
      ]),
    ),
  })
  return user
}

function setsInDb(userId: string) {
  return sql(`select st.set_number, st.reps_done, st.weight from public.sets st
    join public.session_exercises se on se.id = st.session_exercise_id
    join public.sessions s on s.id = se.session_id
    where s.user_id = '${userId}' order by st.set_number`)
}

async function waitFor(check: () => boolean, ms = 10000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('condition not met in time')
}

/** Answers action POSTs as a server that no longer knows their ids. */
async function staleActions(page: Page, isStale: () => boolean) {
  await page.route('**/start', async (route: Route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.headers()['next-action'] && isStale()) {
      // Slow enough that a second tap is queued behind the first.
      await new Promise((r) => setTimeout(r, 700))
      return route.fulfill({
        status: 404,
        headers: {
          'content-type': 'text/plain',
          'x-nextjs-action-not-found': '1',
        },
        body: 'Server action not found.',
      })
    }
    return route.continue()
  })
}

/**
 * Counts full page loads from now on. Not framenavigated: Next's router calls
 * history.replaceState on start-up, which Playwright also reports as a
 * navigation, so that event over-counts reloads.
 */
function countReloads(page: Page) {
  let loads = 0
  page.on('load', () => loads++)
  return () => loads
}

export default suite(
  'e2e-stale-deploy',
  {
    async 'unsaved sets survive a stale build: stored, reloaded, replayed in order'() {
      const user = await userWithSplit('stale')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)
        const reloads = countReloads(page)

        let stale = true
        // The reload lands on the "new build": stop answering 404 from the
        // moment the reloaded document starts loading.
        page.on('framenavigated', (f) => {
          if (f === page.mainFrame() && reloads() === 0) stale = false
        })
        await staleActions(page, () => stale)

        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await keypad(page, '8', '45')
        await page.getByRole('button', { name: 'Log Set' }).click()

        await waitFor(() => reloads() >= 1)
        await page.getByText('Logging Session').first().waitFor()
        await waitFor(() => setsInDb(user.id).length === 2)
        assert.deepEqual(setsInDb(user.id), [
          ['1', '10', '40'],
          ['2', '8', '45'],
        ])
        await page.getByText('8 reps × 45 kg').waitFor()
        assert.equal(await page.getByText('10 reps × 40 kg').count(), 1)
        assert.equal(reloads(), 1, 'reloaded more than once')
        await waitFor(() => true)
        const left = await page.evaluate(
          `Object.keys(sessionStorage).filter((k) => k.startsWith('ajfit-pending-writes:') && !k.endsWith(':reloaded-at')).map((k) => sessionStorage.getItem(k))`,
        )
        assert.deepEqual(left, [], 'replayed writes left behind in storage')
      } finally {
        await ctx.close()
      }
    },

    async 'if the reload does not cure it, it stops, says so, and keeps the sets'() {
      const user = await userWithSplit('stale2')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)
        const reloads = countReloads(page)

        let stale = true
        await staleActions(page, () => stale)

        await keypad(page, '12', '30')
        await page.getByRole('button', { name: 'Log Set' }).click()

        const alert = page.getByRole('alert').filter({ hasText: 'didn’t save' })
        await alert.waitFor({ timeout: 15000 })
        assert.match((await alert.textContent()) ?? '', /app was updated/)
        assert.equal(reloads(), 1, 'expected exactly one reload, no loop')
        // Still on screen and still stored, never dropped.
        await page.getByText('12 reps × 30 kg').waitFor()
        const stored = (await page.evaluate(
          `Object.entries(sessionStorage).filter(([k]) => k.startsWith('ajfit-pending-writes:') && !k.endsWith(':reloaded-at')).map(([, v]) => JSON.parse(v).length)`,
        )) as number[]
        assert.deepEqual(stored, [1])
        assert.deepEqual(setsInDb(user.id), [])

        // Once the server knows the action again, Retry saves it.
        stale = false
        await page.getByRole('button', { name: 'Retry' }).click()
        await waitFor(() => setsInDb(user.id).length === 1)
        assert.deepEqual(setsInDb(user.id), [['1', '12', '30']])
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
