/**
 * One bodyweight entry per day, in the app: a second entry on the same day
 * says "Today's weight updated", leaves one row on the viewer's date, and BMI
 * follows the newer value. Kolkata, London and Muscat.
 */
import assert from 'node:assert/strict'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import { newUser, sql } from '../lib/local'
import { zonedDateKey } from '@/lib/timezone'

async function replaceToday(zone: string) {
  const user = await newUser('wltoday')
  sql(`insert into public.profiles (id, height_cm) values ('${user.id}', 180)`)
  const ctx = await phoneContext({ timeZone: zone })
  const page = await ctx.newPage()
  try {
    await signIn(page, user)
    await page.goto(`${APP_URL}/profile`)
    const input = page.getByLabel(/Log today’s weight/)
    const add = page.getByRole('button', { name: "Log today's weight" })

    await input.fill('81')
    await add.click()
    await page.getByText('Weight logged.').waitFor()

    await input.fill('90')
    await add.click()
    await page.getByText('Today’s weight updated.').waitFor()

    assert.deepEqual(
      sql(`select log_date::text, weight::text from public.weight_logs
        where user_id = '${user.id}'`),
      [[zonedDateKey(zone), '90']],
    )

    // BMI uses the newer entry: 90 / 1.8² = 27.78 → 27.8.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: /BMI/ }).click()
    await page.getByTestId('bmi-value').waitFor()
    assert.equal(await page.getByTestId('bmi-value').textContent(), '27.8')
  } finally {
    await ctx.close()
  }
}

export default suite(
  'e2e-weight-one-per-day',
  {
    async 'Asia/Kolkata: a second entry today replaces the first'() {
      await replaceToday('Asia/Kolkata')
    },
    async 'Europe/London: a second entry today replaces the first'() {
      await replaceToday('Europe/London')
    },
    async 'Asia/Muscat: a second entry today replaces the first'() {
      await replaceToday('Asia/Muscat')
    },

    async 'onboarding after a same-day Profile entry replaces it'() {
      const zone = 'Asia/Kolkata'
      const user = await newUser('wlonb')
      sql(`insert into public.profiles (id, display_name, height_cm)
             values ('${user.id}', 'Rhea', 165);
           insert into public.weight_logs (user_id, log_date, weight)
             values ('${user.id}', '${zonedDateKey(zone)}', 60);`)
      const ctx = await phoneContext({ timeZone: zone, onboardingPrompt: true })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page
          .getByRole('dialog', { name: 'Finish your profile' })
          .waitFor()
        await page.getByLabel('Bodyweight (kg)').fill('61.5')
        await page.getByRole('button', { name: 'Save and continue' }).click()
        await page
          .getByRole('dialog', { name: 'Finish your profile' })
          .waitFor({ state: 'detached' })
        assert.deepEqual(
          sql(
            `select weight::text from public.weight_logs where user_id = '${user.id}'`,
          ),
          [['61.5']],
        )
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
