/**
 * V2 Phase 4.2 — onboarding.
 *
 * New accounts: sign up → /onboarding → Home, ending with a populated profile
 * and a bodyweight entry dated in the viewer's own timezone (Kolkata, London,
 * Muscat). The browser has no timezone cookie yet on that first page, which
 * is exactly the case the form's explicit zone covers.
 *
 * Existing accounts: a prompt, prefilled, shown once per browser session
 * until it is completed.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  newUser,
  sql,
  sqlValue,
  TEST_EMAIL_DOMAIN,
  TEST_PASSWORD,
} from '../lib/local'
import { zonedDateKey } from '@/lib/timezone'

async function signUpAndOnboard(zone: string) {
  const email = `test.onb.${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`
  const ctx = await phoneContext({
    timeZone: zone,
    tzCookie: false,
    onboardingPrompt: true,
  })
  const page = await ctx.newPage()
  try {
    await page.goto(`${APP_URL}/sign-up`)
    await page.fill('input[name=email]', email)
    await page.fill('input[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL(`${APP_URL}/onboarding`)

    await page.getByRole('textbox', { name: 'Name' }).fill('Asha')
    await page.getByRole('radio', { name: 'lbs' }).click()
    await page.getByLabel('Bodyweight (lbs)').fill('160')
    await page.getByRole('radio', { name: 'ft' }).click()
    await page.getByLabel('Height (ft)').fill('5')
    await page.getByLabel('(in)').fill('10')
    await page.getByRole('button', { name: 'Save and continue' }).click()
    await page.waitForURL(`${APP_URL}/`)
    // Finished: no prompt on Home.
    assert.equal(await page.getByRole('dialog').count(), 0)
  } finally {
    await ctx.close()
  }

  const id = sqlValue(`select id from auth.users where email = '${email}'`)
  const profile = sql(`select display_name, weight_unit, height_unit,
      round(height_cm, 2)::text, onboarded_at is not null
    from public.profiles where id = '${id}'`)[0]
  const logs = sql(`select log_date::text, weight::text from public.weight_logs
    where user_id = '${id}'`)
  return { profile, logs }
}

export default suite(
  'e2e-onboarding',
  {
    async 'Asia/Kolkata: signup → onboarding → Home; weight on Kolkata’s date'() {
      const { profile, logs } = await signUpAndOnboard('Asia/Kolkata')
      assert.deepEqual(profile, ['Asha', 'lbs', 'ft', '177.80', 't'])
      assert.equal(logs.length, 1)
      assert.equal(logs[0][0], zonedDateKey('Asia/Kolkata'))
      assert.ok(Math.abs(Number(logs[0][1]) - 72.5747792) < 1e-6)
    },

    async 'Europe/London: the weight entry uses London’s date'() {
      const { logs } = await signUpAndOnboard('Europe/London')
      assert.equal(logs[0][0], zonedDateKey('Europe/London'))
    },

    async 'Asia/Muscat: the weight entry uses Muscat’s date'() {
      const { logs } = await signUpAndOnboard('Asia/Muscat')
      assert.equal(logs[0][0], zonedDateKey('Asia/Muscat'))
    },

    async 'existing account: prompt once per session until finished'() {
      const user = await newUser('onbexisting')
      sql(`insert into public.profiles (id, display_name, height_cm)
           values ('${user.id}', 'Old Name', 172);
           insert into public.weight_logs (user_id, log_date, weight)
           values ('${user.id}', '2026-09-01', 70);`)

      // Session 1: shown, prefilled; "Later" hides it for the session.
      const first = await phoneContext({ onboardingPrompt: true })
      const page = await first.newPage()
      try {
        await signIn(page, user)
        const dialog = page.getByRole('dialog', { name: 'Finish your profile' })
        await dialog.waitFor()
        assert.equal(
          await page.getByRole('textbox', { name: 'Name' }).inputValue(),
          'Old Name',
        )
        assert.equal(
          await page.getByLabel('Bodyweight (kg)').inputValue(),
          '70',
        )
        assert.equal(await page.getByLabel('Height (cm)').inputValue(), '172')
        await page.getByRole('button', { name: 'Later' }).click()
        await dialog.waitFor({ state: 'detached' })
        await page.goto(`${APP_URL}/profile`)
        await page.getByRole('heading', { name: 'Profile' }).waitFor()
        assert.equal(await dialog.count(), 0, 'shown again in the same session')
      } finally {
        await first.close()
      }

      // Session 2: back again, and finishing it ends it for good.
      const second = await phoneContext({ onboardingPrompt: true })
      const page2 = await second.newPage()
      try {
        await signIn(page2, user)
        const dialog = page2.getByRole('dialog', {
          name: 'Finish your profile',
        })
        await dialog.waitFor()
        await page2.getByRole('button', { name: 'Save and continue' }).click()
        await dialog.waitFor({ state: 'detached' })
        await page2.reload()
        await page2.getByText('Dashboard').waitFor()
        assert.equal(await dialog.count(), 0)
      } finally {
        await second.close()
      }
      assert.equal(
        sqlValue(`select (onboarded_at is not null)::text || ',' || display_name
          from public.profiles where id = '${user.id}'`),
        'true,Old Name',
      )
      // The prompt logs today's weight too: the prefilled 70 kg, on today's date.
      assert.equal(
        sqlValue(
          `select count(*) from public.weight_logs where user_id = '${user.id}'`,
        ),
        '2',
      )
    },

    async 'an onboarded account is sent from /onboarding to Home'() {
      const user = await newUser('onbdone')
      sql(
        `insert into public.profiles (id, onboarded_at) values ('${user.id}', now())`,
      )
      const ctx = await phoneContext({ onboardingPrompt: true })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/onboarding`)
        await page.waitForURL(`${APP_URL}/`)
        assert.equal(await page.getByRole('dialog').count(), 0)
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
