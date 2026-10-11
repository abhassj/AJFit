/**
 * Screenshots of Batch B's screens at 414×896 for a visual check.
 *
 *   APP_URL=http://localhost:3100 OUT=<dir> npx tsx tests/perf/screens-b.ts
 */
import path from 'node:path'

import {
  APP_URL,
  closeBrowser,
  keypad,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { deleteTestUsers, must, newUser, seedProgram, sql } from '../lib/local'
import { addDays, dateKey, parseDateKey, weekBounds } from '@/lib/home-types'
import { zonedDateKey } from '@/lib/timezone'

const OUT = process.env.OUT ?? '.'
const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]
const TITLES = [
  'Back & Biceps',
  'Chest & Tri',
  'Shoulders & Legs',
  'Back & Biceps',
  'Chest & Tri',
  'Shoulders & Legs',
  'Rest',
]

async function main() {
  const today = zonedDateKey('Asia/Kolkata')
  const monday = weekBounds(today).start
  const user = await newUser('screensb')
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d, i) => [
        d,
        i === 6
          ? { title: 'Rest', rest: true }
          : {
              title: TITLES[i],
              exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
            },
      ]),
    ),
  })
  sql(`update public.program_exercises x set rest_seconds = 90
       from public.program_days d join public.programs p on p.id = d.program_id
       where d.id = x.program_day_id and p.user_id = '${user.id}'`)
  // Done on Tuesday's slot this week, and a September PR to beat.
  const lockDate =
    today === monday ? dateKey(addDays(parseDateKey(monday), 1)) : monday
  for (const [dow, date] of [
    ['tuesday', lockDate],
    ['monday', '2026-09-01'],
  ]) {
    const s = must(
      await user.client
        .from('sessions')
        .insert({
          user_id: user.id,
          program_day_id: seeded.dayIds[dow],
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
          program_exercise_id: seeded.programExerciseIds[dow][0],
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
  }

  const ctx = await phoneContext()
  const page = await ctx.newPage()
  const shot = (name: string) =>
    page.screenshot({ path: path.join(OUT, `${name}.png`) })
  try {
    await signIn(page, user)
    await page.waitForTimeout(600)
    await shot('b1-home')
    await page.goto(`${APP_URL}/start`)
    await page.getByRole('button', { name: /different day/ }).click()
    await page.waitForTimeout(400)
    await shot('b2-start-picker')
    await page.getByRole('button', { name: 'Close' }).click()
    await startTodaysWorkout(page)
    await keypad(page, '5', '65')
    await page.getByRole('button', { name: 'Log Set' }).click()
    await page.waitForTimeout(300)
    await page.evaluate('window.scrollTo(0, 280)')
    await shot('b3-runner-pr')
    await page.getByRole('button', { name: /Begin Rest/ }).click()
    await page.waitForTimeout(1500)
    await shot('b4-rest')
    await page.getByTestId('rest-timer').getByRole('button').click()
    await page.evaluate('window.scrollTo(0, 0)')
    await page.goto(`${APP_URL}/history/2026-09-01`)
    await page.waitForTimeout(500)
    await shot('b5-day-detail')
  } finally {
    await ctx.close()
    await closeBrowser()
    deleteTestUsers()
  }
}

main()
