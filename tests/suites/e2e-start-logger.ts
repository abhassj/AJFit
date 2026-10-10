/**
 * V2 Phase 1.2/1.3 — the live logger answers instantly, saves in order in the
 * background, never fails silently, and stores kilograms whatever unit the
 * user types in.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  newUser,
  seedProgram,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'

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
        {
          title: 'Arms',
          exercises: ['Barbell Bicep Curl', 'Tricep Rope Pushdown'],
        },
      ]),
    ),
  })
  return user
}

async function startSession(page: Page, user: TestUser) {
  await signIn(page, user)
  await page.goto(`${APP_URL}/start`)
  await page.getByRole('button', { name: 'Start Workout' }).click()
  await page.getByRole('button', { name: 'Confirm Start' }).click()
  await page.getByText('Logging Session').first().waitFor()
}

async function type(page: Page, reps: string, weight: string) {
  for (const k of reps)
    await page.getByRole('button', { name: k, exact: true }).click()
  await page.getByRole('button', { name: /^Weight/ }).click()
  for (const k of weight) {
    await page
      .getByRole('button', { name: k === '.' ? '.' : k, exact: true })
      .click()
  }
}

/** Clicks a button and returns ms until `text` is in the DOM. */
async function timeTo(
  page: Page,
  label: string,
  text: string,
): Promise<number> {
  return page.evaluate(`
    new Promise((resolve, reject) => {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === ${JSON.stringify(label)} && !b.disabled,
      )
      if (!button) return reject(new Error('no button'))
      const t0 = performance.now()
      const obs = new MutationObserver(() => {
        if (document.body.textContent.includes(${JSON.stringify(text)})) {
          obs.disconnect()
          resolve(performance.now() - t0)
        }
      })
      obs.observe(document.body, { subtree: true, childList: true, characterData: true })
      button.click()
      setTimeout(() => reject(new Error('timeout')), 10000)
    })
  `)
}

function setsInDb(userId: string) {
  return sql(`select st.set_number, st.reps_done, st.weight from public.sets st
    join public.session_exercises se on se.id = st.session_exercise_id
    join public.sessions s on s.id = se.session_id
    where s.user_id = '${userId}' order by st.set_number`)
}

async function waitFor(check: () => boolean, ms = 8000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('condition not met in time')
}

export default suite(
  'e2e-start-logger',
  {
    async 'a set appears within 100ms on a 400ms-latency connection'() {
      const user = await userWithSplit('logfast')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await startSession(page, user)
        const cdp = await ctx.newCDPSession(page)
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 400,
          downloadThroughput: 50_000,
          uploadThroughput: 20_000,
        })
        await type(page, '8', '30')
        const ms = await timeTo(page, 'Log Set', '8 reps × 30 kg')
        assert.ok(ms < 100, `took ${Math.round(ms)}ms`)
        await waitFor(() => setsInDb(user.id).length === 1)
        assert.deepEqual(setsInDb(user.id), [['1', '8', '30']])
      } finally {
        await ctx.close()
      }
    },

    async 'lbs are typed and shown as lbs but stored as kg'() {
      const user = await userWithSplit('loglbs')
      sql(`insert into public.profiles (id, weight_unit) values ('${user.id}', 'lbs')
           on conflict (id) do update set weight_unit = 'lbs'`)
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await startSession(page, user)
        await page.getByRole('button', { name: /^Weight \(lbs\)/ }).waitFor()
        await type(page, '5', '135')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await page.getByText('5 reps × 135 lbs').waitFor()
        await waitFor(() => setsInDb(user.id).length === 1)
        const kg = Number(setsInDb(user.id)[0][2])
        assert.ok(Math.abs(kg - 61.23496995) < 1e-6, `stored ${kg}`)
      } finally {
        await ctx.close()
      }
    },

    async 'a failed save is shown, holds later writes in order, and retries'() {
      const user = await userWithSplit('logfail')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await startSession(page, user)

        let blocked = true
        await page.route('**/start', (route) => {
          const req = route.request()
          if (
            blocked &&
            req.method() === 'POST' &&
            req.headers()['next-action']
          ) {
            return route.abort('internetdisconnected')
          }
          return route.continue()
        })

        await type(page, '10', '20')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await type(page, '9', '22.5')
        await page.getByRole('button', { name: 'Log Set' }).click()

        // Both sets are on screen; the failure is visible, not silent.
        await page.getByText('9 reps × 22.5 kg').waitFor()
        const alert = page.getByRole('alert').filter({ hasText: 'didn’t save' })
        await alert.waitFor()
        assert.match((await alert.textContent()) ?? '', /Set 1/)
        assert.deepEqual(setsInDb(user.id), [])

        blocked = false
        await page.getByRole('button', { name: 'Retry' }).click()
        await alert.waitFor({ state: 'detached' })
        await waitFor(() => setsInDb(user.id).length === 2)
        assert.deepEqual(setsInDb(user.id), [
          ['1', '10', '20'],
          ['2', '9', '22.5'],
        ])
      } finally {
        await ctx.close()
      }
    },

    async 'a second tap on the outgoing panel does not touch the completed exercise'() {
      const user = await userWithSplit('logdouble')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await startSession(page, user)
        // Complete, then 40ms later tap Skip — while the completed exercise's
        // panel is still animating out under the thumb.
        await page.evaluate(`
          (async () => {
            const btn = (label) => [...document.querySelectorAll('button')]
              .find((b) => b.textContent?.trim() === label)
            btn('Mark Complete').click()
            await new Promise((r) => setTimeout(r, 40))
            btn('Skip Exercise')?.click()
          })()
        `)
        await page.waitForTimeout(1500)
        assert.equal(
          sqlValue(`select string_agg(se.status, ',' order by pe.exercise_order)
            from public.session_exercises se
            join public.program_exercises pe on pe.id = se.program_exercise_id
            join public.sessions s on s.id = se.session_id
            where s.user_id = '${user.id}'`),
          'completed,pending',
        )
      } finally {
        await ctx.close()
      }
    },

    async 'finish waits for queued saves and the summary matches the database'() {
      const user = await userWithSplit('logfinish')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await startSession(page, user)
        await type(page, '12', '15')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await page.getByRole('button', { name: 'Mark Complete' }).click()
        // Act on the next panel once it is the one on screen, as a user would.
        await page
          .getByRole('heading', { name: 'Tricep Rope Pushdown', level: 2 })
          .waitFor()
        await page.getByRole('button', { name: 'Skip Exercise' }).click()
        await page.getByRole('button', { name: 'Finish' }).click()
        await page.getByText('Workout Complete').waitFor()

        assert.equal(
          sqlValue(
            `select status from public.sessions where user_id = '${user.id}'`,
          ),
          'completed',
        )
        assert.equal(
          sqlValue(`select string_agg(se.status, ',' order by pe.exercise_order)
            from public.session_exercises se
            join public.program_exercises pe on pe.id = se.program_exercise_id
            join public.sessions s on s.id = se.session_id
            where s.user_id = '${user.id}'`),
          'completed,skipped',
        )
        assert.deepEqual(setsInDb(user.id), [['1', '12', '15']])
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
