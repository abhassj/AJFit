/**
 * Batch D item 3 — the rest timer opens by itself after a NEW set on an
 * exercise with rest, and never for edits, replays or history.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import {
  APP_URL,
  closeBrowser,
  keypad,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { suite } from '../lib/harness'
import { must, newUser, seedProgram, sql, type TestUser } from '../lib/local'

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** Every day: Lat Pulldown (rest = `rest`) then Barbell Bicep Curl (no rest). */
async function restUser(tag: string, rest: number | null) {
  const user = await newUser(tag)
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        { title: 'Pull', exercises: ['Lat Pulldown', 'Barbell Bicep Curl'] },
      ]),
    ),
  })
  const firstSlots = Object.values(seeded.programExerciseIds).map(
    (ids) => ids[0],
  )
  sql(`update public.program_exercises set rest_seconds = ${rest === null ? 'null' : rest}
       where id in (${firstSlots.map((id) => `'${id}'`).join(',')})`)
  return { user, seeded }
}

function setsInDb(userId: string) {
  return sql(`select st.set_number, st.reps_done, st.weight from public.sets st
    join public.session_exercises se on se.id = st.session_exercise_id
    join public.sessions s on s.id = se.session_id
    where s.user_id = '${userId}' and s.status = 'in_progress'
    order by st.set_number`)
}

async function waitFor(check: () => boolean, ms = 10000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('condition not met in time')
}

const overlay = (page: Page) => page.getByTestId('rest-timer')

async function begin(user: TestUser, opts: { clock?: boolean } = {}) {
  const ctx = await phoneContext()
  const page = await ctx.newPage()
  if (opts.clock) await page.clock.install()
  await signIn(page, user)
  await startTodaysWorkout(page)
  return { ctx, page }
}

export default suite(
  'e2e-rest-auto',
  {
    async 'a fresh set opens the timer at once, for the exercise’s rest'() {
      const { user } = await restUser('restauto', 90)
      const { ctx, page } = await begin(user)
      try {
        await keypad(page, '10', '40')
        const ms = (await page.evaluate(`
          new Promise((resolve) => {
            const t0 = performance.now()
            const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Log Set')
            const obs = new MutationObserver(() => {
              if (document.querySelector('[data-testid="rest-timer"]')) { obs.disconnect(); resolve(performance.now() - t0) }
            })
            obs.observe(document.body, { subtree: true, childList: true })
            btn.click()
          })
        `)) as number
        assert.ok(ms < 150, `timer took ${Math.round(ms)}ms to open`)
        const remaining = Number(
          await overlay(page).getAttribute('data-rest-remaining'),
        )
        assert.ok(remaining >= 88 && remaining <= 90, `remaining ${remaining}`)
        assert.equal(
          (await overlay(page).getByRole('button').textContent())?.trim(),
          'Skip Rest',
        )
        await waitFor(() => setsInDb(user.id).length === 1)
      } finally {
        await ctx.close()
      }
    },

    async 'no timer when rest is null, or 0'() {
      for (const rest of [null, 0]) {
        const { user } = await restUser(`restnone${rest ?? 'null'}`, rest)
        const { ctx, page } = await begin(user)
        try {
          await keypad(page, '10', '40')
          await page.getByRole('button', { name: 'Log Set' }).click()
          await page.getByText('10 reps × 40 kg').waitFor()
          await page.waitForTimeout(400)
          assert.equal(await overlay(page).count(), 0, `rest ${rest}`)
        } finally {
          await ctx.close()
        }
      }
    },

    async 'Skip closes it; logging again restarts it; sets land in order'() {
      const { user } = await restUser('restskip', 60)
      const { ctx, page } = await begin(user)
      try {
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).getByRole('button', { name: 'Skip Rest' }).click()
        await overlay(page).waitFor({ state: 'detached' })
        await keypad(page, '8', '45')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).waitFor()
        const remaining = Number(
          await overlay(page).getAttribute('data-rest-remaining'),
        )
        assert.ok(remaining >= 58, `not restarted: ${remaining}`)
        await waitFor(() => setsInDb(user.id).length === 2)
        assert.deepEqual(setsInDb(user.id), [
          ['1', '10', '40'],
          ['2', '8', '45'],
        ])
      } finally {
        await ctx.close()
      }
    },

    async 'correcting a set does not open the timer'() {
      const { user } = await restUser('restedit', 60)
      const { ctx, page } = await begin(user)
      try {
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).getByRole('button').click()
        await overlay(page).waitFor({ state: 'detached' })
        await page.getByRole('button', { name: 'Previous Set' }).click()
        await page.getByRole('button', { name: 'Delete', exact: true }).click()
        await page.getByRole('button', { name: '2', exact: true }).click()
        await page.getByRole('button', { name: 'Update Set' }).click()
        await page.getByText('12 reps × 40 kg').waitFor()
        await page.waitForTimeout(400)
        assert.equal(await overlay(page).count(), 0)
      } finally {
        await ctx.close()
      }
    },

    async 'a replay after a stale-deploy reload does not open the timer'() {
      const { user } = await restUser('restreplay', 60)
      const { ctx, page } = await begin(user)
      try {
        let stale = true
        await page.route('**/start', async (route) => {
          const req = route.request()
          if (
            stale &&
            req.method() === 'POST' &&
            req.headers()['next-action']
          ) {
            stale = false
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
        const reloaded = page.waitForEvent('load')
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await reloaded
        await page.getByText('Logging Session').first().waitFor()
        await waitFor(() => setsInDb(user.id).length === 1)
        await page.getByText('10 reps × 40 kg').waitFor()
        assert.equal(await overlay(page).count(), 0, 'replay opened the timer')
      } finally {
        await ctx.close()
      }
    },

    async 'adding a set in the history editor never opens it'() {
      const { user, seeded } = await restUser('resthistory', 60)
      const s = must(
        await user.client
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: seeded.dayIds.monday,
            session_date: '2026-09-07',
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      must(
        await user.client.from('session_exercises').insert({
          session_id: s.id,
          program_exercise_id: seeded.programExerciseIds.monday[0],
          status: 'completed',
        }),
      )
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/history/2026-09-07?edit=1`)
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Add Set' }).click()
        await page.getByText('10 × 40 kg').waitFor()
        await page.waitForTimeout(400)
        assert.equal(await overlay(page).count(), 0)
      } finally {
        await ctx.close()
      }
    },

    async 'it keeps time through 30s in the background'() {
      const { user } = await restUser('restbackground', 60)
      const { ctx, page } = await begin(user, { clock: true })
      try {
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).waitFor()
        // Backgrounded: no renders for 30s, then the app comes back.
        await page.evaluate(
          `document.dispatchEvent(new Event('visibilitychange'))`,
        )
        await page.clock.fastForward(30_000)
        await page.evaluate(
          `document.dispatchEvent(new Event('visibilitychange'))`,
        )
        await page.waitForTimeout(1200)
        const remaining = Number(
          await overlay(page).getAttribute('data-rest-remaining'),
        )
        assert.ok(remaining >= 28 && remaining <= 31, `remaining ${remaining}`)
      } finally {
        await ctx.close()
      }
    },

    async 'a New PR set shows the badge on the rest overlay'() {
      const { user, seeded } = await restUser('restnewpr', 60)
      const s = must(
        await user.client
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: seeded.dayIds.monday,
            session_date: '2026-09-01',
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      const se = must(
        await user.client
          .from('session_exercises')
          .insert({
            session_id: s.id,
            program_exercise_id: seeded.programExerciseIds.monday[0],
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      must(
        await user.client.from('sets').insert({
          session_exercise_id: se.id,
          set_number: 1,
          reps_done: 8,
          weight: 60,
        }),
      )
      const { ctx, page } = await begin(user)
      try {
        await keypad(page, '5', '65')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).getByText('New PR', { exact: true }).waitFor()
        await overlay(page).getByRole('button').click()
        await keypad(page, '5', '50')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).waitFor()
        assert.equal(
          await overlay(page).getByText('New PR', { exact: true }).count(),
          0,
        )
      } finally {
        await ctx.close()
      }
    },

    async 'a failed save still opens the timer, and Retry shows once it closes'() {
      const { user } = await restUser('restfail', 60)
      const { ctx, page } = await begin(user)
      try {
        await page.route('**/start', (route) =>
          route.request().headers()['next-action']
            ? route.abort('internetdisconnected')
            : route.continue(),
        )
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await overlay(page).waitFor()
        await page
          .getByRole('alert')
          .filter({ hasText: 'didn’t save' })
          .waitFor({ state: 'attached' })
        await overlay(page).getByRole('button').click()
        await overlay(page).waitFor({ state: 'detached' })
        assert.ok(
          await page.getByRole('button', { name: 'Retry' }).isVisible(),
          'Retry hidden after the timer closed',
        )
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
