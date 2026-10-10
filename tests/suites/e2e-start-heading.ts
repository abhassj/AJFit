/**
 * V2 Phase 1.1 — the Start heading always names the workout actually being
 * done, and the session row in the database agrees with it.
 *
 * Reported as "Back & Biceps on a Shoulders & Legs day". Three ways in:
 *   default    today's own workout
 *   chosen     a different day's workout picked from the day picker
 *   first-visit no timezone cookie yet, so the server's first render used UTC
 *               and the client refreshed once with the real zone
 */
import assert from 'node:assert/strict'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import { newUser, seedProgram, sqlValue } from '../lib/local'
import { zonedNow } from '@/lib/timezone'

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

const TITLES: Record<(typeof DAYS)[number], string> = {
  monday: 'Back & Biceps',
  tuesday: 'Chest & Tri',
  wednesday: 'Shoulders & Legs',
  thursday: 'Pull Day',
  friday: 'Push Day',
  saturday: 'Leg Day',
  sunday: 'Full Body',
}

function dowIn(timeZone: string) {
  return DAYS[(zonedNow(timeZone).getDay() + 6) % 7]
}

async function seededUser(tag: string) {
  const user = await newUser(tag)
  await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [d, { title: TITLES[d], exercises: ['Lat Pulldown'] }]),
    ),
  })
  return user
}

function sessionTitleInDb(userId: string) {
  return sqlValue(`select pd.title from public.sessions s
    join public.program_days pd on pd.id = s.program_day_id
    where s.user_id = '${userId}'`)
}

export default suite(
  'e2e-start-heading',
  {
    async 'default day: heading, runner and DB all name today’s workout'() {
      const user = await seededUser('headdefault')
      const ctx = await phoneContext({ timeZone: 'Asia/Kolkata' })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/start`)
        const expected = TITLES[dowIn('Asia/Kolkata')]
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          expected,
        )

        await page.getByRole('button', { name: 'Start Workout' }).click()
        await page.getByRole('button', { name: 'Confirm Start' }).click()
        await page.getByText('Logging Session').waitFor()
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          expected,
        )
        assert.equal(sessionTitleInDb(user.id), expected)
      } finally {
        await ctx.close()
      }
    },

    async 'chosen day: running another day’s workout is titled as that day'() {
      const user = await seededUser('headchosen')
      const ctx = await phoneContext({ timeZone: 'Asia/Kolkata' })
      const page = await ctx.newPage()
      try {
        const today = dowIn('Asia/Kolkata')
        const other = DAYS[(DAYS.indexOf(today) + 2) % 7]
        await signIn(page, user)
        await page.goto(`${APP_URL}/start`)
        await page.getByRole('button', { name: /different day/ }).click()
        await page
          .getByRole('button', { name: new RegExp(TITLES[other]) })
          .click()
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          TITLES[other],
        )

        await page.getByRole('button', { name: 'Start Workout' }).click()
        await page.getByRole('button', { name: 'Confirm Start' }).click()
        await page.getByText('Logging Session').waitFor()
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          TITLES[other],
          'runner heading should name the chosen day, not today',
        )
        assert.equal(sessionTitleInDb(user.id), TITLES[other])

        // A reload re-derives the heading from the database, not client state.
        await page.reload()
        await page.getByText('Logging Session').first().waitFor()
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          TITLES[other],
        )
      } finally {
        await ctx.close()
      }
    },

    async 'first visit: the UTC render is corrected after the zone is known'() {
      /*
       * Pick whichever extreme zone is on a different weekday from UTC right
       * now. One of +14 and -11 always is, since together they span 25 hours.
       */
      const utcDow = dowIn('UTC')
      const zone =
        dowIn('Pacific/Kiritimati') !== utcDow
          ? 'Pacific/Kiritimati'
          : 'Pacific/Pago_Pago'
      const expected = TITLES[dowIn(zone)]
      assert.notEqual(dowIn(zone), utcDow)

      const user = await seededUser('headfirst')
      const ctx = await phoneContext({ timeZone: zone, tzCookie: false })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/start`)
        // TimezoneSync writes the cookie and refreshes once. Predicates are
        // passed as source text: tsx's __name helper does not exist in the
        // page, so a compiled function literal would throw there.
        await page.waitForFunction(`document.cookie.includes('ajfit-tz=')`)
        await page
          .waitForFunction(
            `[...document.querySelectorAll('main h1')].pop()?.textContent?.trim() === ${JSON.stringify(expected)}`,
            undefined,
            { timeout: 8000 },
          )
          .catch(() => undefined)
        const shown = (
          await page.locator('main h1').last().textContent()
        )?.trim()
        assert.equal(
          shown,
          expected,
          `heading should follow the corrected weekday (${zone}): showed "${shown}", expected "${expected}"`,
        )

        await page.getByRole('button', { name: 'Start Workout' }).click()
        await page.getByRole('button', { name: 'Confirm Start' }).click()
        await page.getByText('Logging Session').first().waitFor()
        assert.equal(
          (await page.locator('main h1').last().textContent())?.trim(),
          expected,
        )
        assert.equal(sessionTitleInDb(user.id), expected)
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
