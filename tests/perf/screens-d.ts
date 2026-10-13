/**
 * Batch D screenshots at 414×896 (and the auth pages at 360×740 too).
 *
 *   APP_URL=http://localhost:3100 OUT=<dir> npx tsx tests/perf/screens-d.ts
 */
import path from 'node:path'

import {
  APP_URL,
  closeBrowser,
  getBrowser,
  keypad,
  phoneContext,
  signIn,
  startTodaysWorkout,
} from '../lib/browser'
import { deleteTestUsers, must, newUser, seedProgram, sql } from '../lib/local'
import { addDays, dateKey, parseDateKey } from '@/lib/home-types'
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

async function main() {
  const user = await newUser('screensd')
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [
        d,
        { title: 'Pull', exercises: ['Lat Pulldown', 'Barbell Bicep Curl'] },
      ]),
    ),
  })
  sql(`update public.program_exercises x set rest_seconds = 90
       from public.program_days d join public.programs p on p.id = d.program_id
       where d.id = x.program_day_id and p.user_id = '${user.id}'`)
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
    await user.client.from('sets').insert({
      session_exercise_id: se.id,
      set_number: 1,
      reps_done: 8,
      weight: 60,
    }),
  )

  const ctx = await phoneContext()
  const page = await ctx.newPage()
  const shot = (name: string) =>
    page.screenshot({ path: path.join(OUT, `${name}.png`) })
  try {
    await signIn(page, user)
    await page.goto(`${APP_URL}/start`)
    await page.waitForTimeout(600)
    await shot('d2-start-list-pr')
    await startTodaysWorkout(page)
    await page.evaluate('window.scrollTo(0, 260)')
    await page.waitForTimeout(300)
    await shot('d2-runner-pr-pill')
    await keypad(page, '5', '65')
    await page.getByRole('button', { name: 'Log Set' }).click()
    await page.waitForTimeout(900)
    await shot('d3-rest-autostart-newpr')
    await page.getByTestId('rest-timer').getByRole('button').click()
    await page.getByRole('button', { name: 'Mark Complete' }).click()
    await page.waitForTimeout(500)
    await page.evaluate('window.scrollTo(0, 260)')
    await shot('d2-runner-no-pr')
  } finally {
    await ctx.close()
  }

  for (const [w, h] of [
    [414, 896],
    [360, 740],
  ]) {
    const c = await (
      await getBrowser()
    ).newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const p = await c.newPage()
    for (const route of ['sign-in', 'sign-up']) {
      await p.goto(`${APP_URL}/${route}`)
      await p.waitForTimeout(700)
      await p.screenshot({ path: path.join(OUT, `d4-${route}-${w}x${h}.png`) })
    }
    await c.close()
  }
  await closeBrowser()
  deleteTestUsers()
}

main()
