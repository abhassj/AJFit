/**
 * Batch D item 1 in the browser: an exercise only ever done without weight
 * shows "PR 17 REPS" (never kg/lbs), earns a New PR badge for more reps, and
 * appears on the PR page.
 */
import assert from 'node:assert/strict'

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
import { addDays, dateKey, parseDateKey } from '@/lib/home-types'
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

/** A user whose last finished session (8 days ago) had 17 bodyweight reps. */
async function seventeenRepUser(tag: string, unit: 'kg' | 'lbs' = 'kg') {
  const user = await newUser(tag)
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        { title: 'Shoulders', exercises: ['Cable Lateral Raise'] },
      ]),
    ),
  })
  if (unit === 'lbs') {
    sql(
      `insert into public.profiles (id, weight_unit) values ('${user.id}', 'lbs')`,
    )
  }
  // Last week, so the weekly lock leaves today's workout startable.
  const date = dateKey(addDays(parseDateKey(zonedDateKey('Asia/Kolkata')), -8))
  const s = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: seeded.dayIds.monday,
        session_date: date,
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
    await user.client.from('sets').insert([
      {
        session_exercise_id: se.id,
        set_number: 1,
        reps_done: 17,
        weight: null,
      },
      {
        session_exercise_id: se.id,
        set_number: 2,
        reps_done: 14,
        weight: null,
      },
    ]),
  )
  return user
}

async function repsOnly(page: import('@playwright/test').Page, reps: string) {
  for (const k of reps) {
    await page.getByRole('button', { name: k, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Log Set' }).click()
}

async function startWith(user: TestUser) {
  const ctx = await phoneContext()
  const page = await ctx.newPage()
  await signIn(page, user)
  await startTodaysWorkout(page)
  return { ctx, page }
}

export default suite(
  'e2e-pr-reps',
  {
    async 'a no-weight record reads "PR 17 REPS", not kg'() {
      const user = await seventeenRepUser('prreps')
      const { ctx, page } = await startWith(user)
      try {
        const pr = page.getByTestId('exercise-pr')
        assert.equal((await pr.textContent())?.trim(), 'PR 17 REPS')
        assert.doesNotMatch((await pr.textContent()) ?? '', /kg|lbs/)
      } finally {
        await ctx.close()
      }
    },

    async 'more reps without weight earns New PR; fewer does not'() {
      const user = await seventeenRepUser('prrepsbadge')
      const { ctx, page } = await startWith(user)
      try {
        await repsOnly(page, '18')
        await page.getByText('18 reps × —').waitFor()
        await repsOnly(page, '10')
        await page.getByText('10 reps × —').waitFor()
        assert.equal(await page.getByText('New PR', { exact: true }).count(), 1)
        // A weighted set is not compared against a reps record.
        await keypad(page, '5', '10')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await page.getByText('5 reps × 10 kg').waitFor()
        assert.equal(await page.getByText('New PR', { exact: true }).count(), 1)
      } finally {
        await ctx.close()
      }
    },

    async 'lbs users see the same reps record, unconverted'() {
      const user = await seventeenRepUser('prrepslbs', 'lbs')
      const { ctx, page } = await startWith(user)
      try {
        assert.equal(
          (await page.getByTestId('exercise-pr').textContent())?.trim(),
          'PR 17 REPS',
        )
      } finally {
        await ctx.close()
      }
    },

    async 'the PR page lists the reps record, without the old exclusion note'() {
      const user = await seventeenRepUser('prrepspage')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/profile/prs`)
        const shoulders = page.getByRole('region', { name: 'Shoulders' })
        await shoulders.waitFor()
        const text = (await shoulders.textContent()) ?? ''
        assert.match(text, /Cable Lateral Raise/)
        assert.match(text, /17 reps/)
        assert.doesNotMatch(text, /kg|lbs/)
        assert.doesNotMatch(
          (await page.locator('main').last().textContent()) ?? '',
          /aren’t ranked|excluded/,
        )
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
