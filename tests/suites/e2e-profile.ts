/**
 * V2 Phase 4 — units on every screen (and nothing stored converted), the BMI
 * dialog with and without reduced motion, and the PR page.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  must,
  newUser,
  seedProgram,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'
import { zonedDateKey } from '@/lib/timezone'

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/**
 * A user with a 135 lb (61.23496995 kg) Lat Pulldown and RDL record from a
 * finished September session, 61.23496995 kg of bodyweight, a 70 kg goal and
 * a 5′11″ (180.34 cm) height.
 */
async function liftingUser(tag: string): Promise<TestUser> {
  const user = await newUser(tag)
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        {
          title: 'Pull',
          exercises: ['Lat Pulldown', 'Romanian Deadlift (RDL)'],
        },
      ]),
    ),
  })
  sql(`insert into public.profiles (id, goal_bodyweight, height_cm)
       values ('${user.id}', 70, 180.34);
       insert into public.weight_logs (user_id, log_date, weight)
       values ('${user.id}', '2026-09-01', 61.23496995);`)
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
  const ses = must(
    await user.client
      .from('session_exercises')
      .insert(
        seeded.programExerciseIds.monday.map((id) => ({
          session_id: s.id,
          program_exercise_id: id,
          status: 'completed',
        })),
      )
      .select('id'),
  )
  must(
    await user.client.from('sets').insert(
      ses.map((se) => ({
        session_exercise_id: se.id,
        set_number: 1,
        reps_done: 8,
        weight: 61.23496995,
      })),
    ),
  )
  return user
}

/** Every stored weight and height of the user, as text. */
function storedMeasurements(userId: string) {
  return sql(`select 'w', weight::text from public.weight_logs where user_id = '${userId}'
    union all select 'g', goal_bodyweight::text from public.profiles where id = '${userId}'
    union all select 'h', height_cm::text from public.profiles where id = '${userId}'
    union all select 's', st.weight::text from public.sets st
      join public.session_exercises se on se.id = st.session_exercise_id
      join public.sessions s on s.id = se.session_id where s.user_id = '${userId}'
    order by 1, 2`)
}

async function mainText(page: Page) {
  return (await page.locator('main').last().textContent()) ?? ''
}

export default suite(
  'e2e-profile',
  {
    async 'switching to lbs and ft changes every screen and no stored value'() {
      const user = await liftingUser('units')
      const before = storedMeasurements(user.id)
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile`)
        assert.match(await mainText(page), /61\.2 kg/)

        await page.getByRole('radio', { name: 'lbs' }).click()
        await page.getByText('Weights now in lbs.').waitFor()
        await page.getByRole('radio', { name: 'ft' }).click()
        await page.getByText('Height now in feet.').waitFor()
        assert.equal(
          sqlValue(`select weight_unit || ',' || height_unit from public.profiles
            where id = '${user.id}'`),
          'lbs,ft',
        )

        const profile = await mainText(page)
        assert.match(profile, /135 lbs/) // bodyweight
        assert.match(profile, /154\.3 lbs/) // goal, 70 kg
        assert.equal(await page.getByLabel('Height (ft)').inputValue(), '5')
        assert.equal(await page.getByLabel('(in)').inputValue(), '11')

        await page.goto(`${APP_URL}/profile/prs`)
        assert.match(await mainText(page), /135 lbs/)

        await page.goto(`${APP_URL}/history/2026-09-07`)
        assert.match(await mainText(page), /135 lbs/)

        await page.goto(`${APP_URL}/start`)
        assert.match(await mainText(page), /PR 135 lbs/)

        // Nothing stored moved: same numbers, to the last digit.
        assert.deepEqual(storedMeasurements(user.id), before)
      } finally {
        await ctx.close()
      }
    },

    async 'BMI animates to its value; reduced motion shows it at once'() {
      const user = await newUser('bmi')
      sql(`insert into public.profiles (id, height_cm) values ('${user.id}', 180);
           insert into public.weight_logs (user_id, log_date, weight)
           values ('${user.id}', '2026-09-01', 81);`)

      // Animated: the number starts low and counts up to 25.0.
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile`)
        await page.getByRole('button', { name: /BMI/ }).click()
        const value = page.getByTestId('bmi-value')
        await value.waitFor()
        const early = Number(await value.textContent())
        assert.ok(early < 25, `started at ${early}`)
        await page.waitForFunction(
          `document.querySelector('[data-testid="bmi-value"]')?.textContent === '25.0'`,
          undefined,
          { timeout: 5000 },
        )
        const band = page.getByTestId('bmi-band')
        assert.equal(await band.getAttribute('data-band'), 'over')
        assert.match(
          (await page.getByTestId('bmi-dialog').textContent()) ?? '',
          /can’t tell muscle from fat/,
        )
      } finally {
        await ctx.close()
      }

      // Reduced motion: the final value is there on the first frame.
      const reduced = await phoneContext()
      const page2 = await reduced.newPage()
      try {
        await page2.emulateMedia({ reducedMotion: 'reduce' })
        await signIn(page2, user)
        await page2.goto(`${APP_URL}/profile`)
        await page2.getByRole('button', { name: /BMI/ }).click()
        await page2.getByTestId('bmi-value').waitFor()
        assert.equal(await page2.getByTestId('bmi-value').textContent(), '25.0')
        const opacity = await page2
          .getByTestId('bmi-band')
          .evaluate((el) => getComputedStyle(el.parentElement!).opacity)
        assert.equal(opacity, '1')
      } finally {
        await reduced.close()
      }
    },

    async 'without a height, BMI asks for it instead of opening'() {
      const user = await newUser('bmimissing')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile`)
        await page.getByText('Add your height below to see it').waitFor()
        // Nothing to open: the row is text, not a button.
        assert.equal(await page.getByRole('button', { name: /BMI/ }).count(), 0)
        assert.equal(await page.getByTestId('bmi-dialog').count(), 0)
      } finally {
        await ctx.close()
      }
    },

    async 'the PR page groups by category in catalog order; RDL is in both'() {
      const user = await liftingUser('prpage')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile/prs`)
        const headings = await page.locator('main section h2').allTextContents()
        assert.deepEqual(headings, ['Back', 'Legs'])
        const back =
          (await page.getByRole('region', { name: 'Back' }).textContent()) ?? ''
        const legs =
          (await page.getByRole('region', { name: 'Legs' }).textContent()) ?? ''
        assert.match(back, /Lat Pulldown/)
        assert.match(back, /Romanian Deadlift/)
        assert.match(legs, /Romanian Deadlift/)
        assert.match(legs, /61\.2 kg/)
        assert.match(back, /× 8 reps/)
      } finally {
        await ctx.close()
      }
    },

    async 'a new account sees the empty PR state'() {
      const user = await newUser('prempty')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile/prs`)
        await page.getByText('No records yet.').waitFor()
      } finally {
        await ctx.close()
      }
    },

    async 'logging bodyweight in lbs stores kg on the viewer’s date'() {
      const user = await newUser('bwlbs')
      sql(
        `insert into public.profiles (id, weight_unit) values ('${user.id}', 'lbs')`,
      )
      const ctx = await phoneContext({ timeZone: 'Asia/Muscat' })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile`)
        await page.getByLabel(/Log today’s weight/).fill('160')
        await page.getByRole('button', { name: "Log today's weight" }).click()
        await page.getByText('Weight logged.').waitFor()
        const [[date, kg]] =
          sql(`select log_date::text, weight::text from public.weight_logs
          where user_id = '${user.id}'`)
        assert.equal(date, zonedDateKey('Asia/Muscat'))
        assert.ok(Math.abs(Number(kg) - 72.5747792) < 1e-6, kg)
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
