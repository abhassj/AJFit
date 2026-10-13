/**
 * V2 Phase 2.2–2.4 — the rest timer's single button, PRs beside the exercise
 * (checked against a direct SQL query), the client "New PR" badge, and the
 * finish guard for a session with nothing completed.
 */
import assert from 'node:assert/strict'

import {
  closeBrowser,
  keypad,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { suite } from '../lib/harness'
import {
  must,
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

/** A user whose every day is Lat Pulldown (3x10, 5s rest) + Bicep Curl. */
async function userWithHistory(tag: string): Promise<TestUser> {
  const user = await newUser(tag)
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        { title: 'Pull', exercises: ['Lat Pulldown', 'Barbell Bicep Curl'] },
      ]),
    ),
  })
  sql(`update public.program_exercises set rest_seconds = 5
       where id in (${Object.values(seeded.programExerciseIds)
         .map((ids) => `'${ids[0]}'`)
         .join(',')})`)

  // A finished session in September: Lat Pulldown 60×8 and 55×10.
  const past = must(
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
        session_id: past.id,
        program_exercise_id: seeded.programExerciseIds.monday[0],
        status: 'completed',
      })
      .select('id')
      .single(),
  )
  must(
    await user.client.from('sets').insert([
      { session_exercise_id: se.id, set_number: 1, reps_done: 8, weight: 60 },
      { session_exercise_id: se.id, set_number: 2, reps_done: 10, weight: 55 },
    ]),
  )
  return user
}

export default suite(
  'e2e-start-phase2',
  {
    async 'the PR beside the exercise matches SQL, and a heavier set is a New PR'() {
      const user = await userWithHistory('prs')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)

        // Direct SQL, independent of exercise_prs(): heaviest completed set.
        const [[weight, reps]] = sql(`select st.weight::float, st.reps_done
          from public.sets st
          join public.session_exercises se on se.id = st.session_exercise_id
          join public.sessions s on s.id = se.session_id
          join public.exercises e on e.id = se.exercise_id
          where s.user_id = '${user.id}' and s.status = 'completed'
            and e.name = 'Lat Pulldown'
          order by st.weight desc, st.reps_done desc limit 1`)
        assert.equal(
          (await page.getByTestId('exercise-pr').textContent())?.trim(),
          `PR ${weight} kg × ${reps}`,
        )

        await keypad(page, '5', '65')
        await page.getByRole('button', { name: 'Log Set' }).click()
        // CHANGED in Batch D: Lat Pulldown has 5s rest here, and rest now opens
        // by itself after a fresh set, covering the keypad. Close it first.
        // (Previously the next keypad tap followed directly.)
        await page.getByTestId('rest-timer').getByRole('button').click()
        await page.getByTestId('rest-timer').waitFor({ state: 'detached' })
        await keypad(page, '8', '50')
        await page.getByRole('button', { name: 'Log Set' }).click()
        await page.getByText('8 reps × 50 kg').waitFor()
        assert.equal(await page.getByText('New PR', { exact: true }).count(), 1)
      } finally {
        await ctx.close()
      }
    },

    async 'rest has one button: Skip Rest while counting, Next Set when done'() {
      const user = await userWithHistory('rest')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)
        await keypad(page, '10', '40')
        await page.getByRole('button', { name: 'Log Set' }).click()
        // CHANGED in Batch D: rest opens by itself after a fresh set.
        // Previously: await page.getByRole('button', { name: /Begin Rest/ }).click()

        const overlay = page.getByTestId('rest-timer')
        await overlay.waitFor()
        assert.equal(await overlay.getByRole('button').count(), 1)
        assert.equal(
          (await overlay.getByRole('button').textContent())?.trim(),
          'Skip Rest',
        )
        assert.match(
          (await overlay.textContent()) ?? '',
          /Lat Pulldown · Set 2 of 3/,
        )

        // Timestamp-based: it finishes on time even if nothing re-rendered it.
        await page.waitForSelector('[data-rest-done="true"]', { timeout: 9000 })
        assert.equal(
          (await overlay.getByRole('button').textContent())?.trim(),
          'Next Set',
        )
        await overlay.getByRole('button').click()
        await overlay.waitFor({ state: 'detached' })
        assert.equal(
          await page
            .getByRole('button', { name: /^Reps Done/ })
            .getAttribute('aria-pressed'),
          'true',
          'keypad is back on reps',
        )
      } finally {
        await ctx.close()
      }
    },

    async 'finishing with nothing completed asks first; Mark Skipped skips the day'() {
      const user = await userWithHistory('finishguard')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)
        await page.getByRole('button', { name: 'Finish' }).click()
        const dialog = page.getByRole('alertdialog')
        await dialog.waitFor()
        assert.match(
          (await dialog.textContent()) ?? '',
          /No exercises completed/,
        )

        await page.getByRole('button', { name: 'Keep logging' }).click()
        await dialog.waitFor({ state: 'detached' })
        assert.equal(
          sqlValue(`select status from public.sessions
            where user_id = '${user.id}' and session_date <> '2026-09-01'`),
          'in_progress',
        )

        await page.getByRole('button', { name: 'Finish' }).click()
        await page.getByRole('button', { name: 'Mark Skipped' }).click()
        await page.getByText('Day Skipped').waitFor()
        assert.equal(
          sqlValue(`select status from public.sessions
            where user_id = '${user.id}' and session_date <> '2026-09-01'`),
          'skipped',
        )
      } finally {
        await ctx.close()
      }
    },

    async 'finishing with an exercise completed does not ask'() {
      const user = await userWithHistory('finishok')
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await startTodaysWorkout(page)
        await page.getByRole('button', { name: 'Mark Complete' }).click()
        await page.getByRole('button', { name: 'Finish' }).click()
        await page.getByText('Workout Complete').waitFor()
        assert.equal(await page.getByRole('alertdialog').count(), 0)
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
