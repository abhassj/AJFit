/**
 * V2 Phase 5 in the browser: the Split page's title and 2-minute default
 * rest, the unilateral Arms exercises in the Workouts catalog, and the
 * Ezlyfts name on the shell, the tab and the auth pages.
 */
import assert from 'node:assert/strict'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import { newUser, seedProgram } from '../lib/local'

export default suite(
  'e2e-phase5',
  {
    async 'the Split page is titled My Workout Split, and new exercises rest 120s'() {
      const user = await newUser('split120')
      await seedProgram(user, {
        days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
      })
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/program`)
        assert.equal(await page.title(), 'My Workout Split · Ezlyfts')
        await page.getByText('My Workout Split').first().waitFor()

        await page
          .getByRole('button', { name: 'Edit My Workout Split' })
          .click()
        // Days are collapsed; open Monday to reach its exercises.
        await page.getByRole('button', { name: /Pull/ }).click()
        const restFields = page.getByLabel('Rest timer (sec)')
        const before = await restFields.count()
        await page
          .getByRole('button', { name: /Add exercise/ })
          .first()
          .click()
        await page.waitForFunction(
          `document.querySelectorAll('input').length > 0`,
        )
        assert.equal(await restFields.count(), before + 1)
        assert.equal(await restFields.nth(before).inputValue(), '120')
        // The slot that already existed keeps its own (null) rest.
        if (before > 0) assert.equal(await restFields.first().inputValue(), '')
      } finally {
        await ctx.close()
      }
    },

    async 'single-arm Arms exercises appear in the Workouts catalog'() {
      const user = await newUser('catalogui')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/workouts`)
        await page.getByRole('button', { name: /Arms/ }).click()
        const text = (await page.locator('main').last().textContent()) ?? ''
        for (const name of [
          'Single-Arm Cable Curl',
          'Concentration Curl',
          'Cross-Body Hammer Curl',
          'Single-Arm Cable Pushdown',
          'Dumbbell Tricep Kickback',
        ]) {
          assert.match(text, new RegExp(name), name)
        }
      } finally {
        await ctx.close()
      }
    },

    async 'the shell, tab title and auth pages say Ezlyfts'() {
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await page.goto(`${APP_URL}/sign-in`)
        assert.equal(await page.title(), 'Sign in · Ezlyfts')
        assert.match(
          (await page.locator('main').textContent()) ?? '',
          /Ezlyfts/,
        )
        assert.doesNotMatch((await page.content()) ?? '', /AJFit/i)

        const user = await newUser('brandshell')
        await signIn(page, user)
        assert.equal(await page.title(), 'Home · Ezlyfts')
        assert.equal(
          (
            await page
              .getByRole('link', { name: 'Ezlyfts' })
              .first()
              .textContent()
          )?.trim(),
          'Ezlyfts',
        )

        const res = await page.request.get(`${APP_URL}/manifest.webmanifest`)
        const json = await res.json()
        assert.equal(json.name, 'Ezlyfts')
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
