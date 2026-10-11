/**
 * V2 Phase 3 — Home: status colours, initials on the weekly bar, and the
 * read-only day detail with its edit round trip.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import {
  APP_URL,
  closeBrowser,
  keypad,
  phoneContext,
  signIn,
} from '../lib/browser'
import { suite } from '../lib/harness'
import { must, newUser, seedProgram, sql, type TestUser } from '../lib/local'
import { addDays, dateKey, parseDateKey, weekBounds } from '@/lib/home-types'
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
const ZONE = 'Asia/Kolkata'

async function session(
  user: TestUser,
  dayId: string,
  date: string,
  status: 'completed' | 'skipped' | 'in_progress',
  exercises: {
    slot: string
    status: 'completed' | 'skipped' | 'pending'
  }[] = [],
) {
  const s = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: dayId,
        session_date: date,
        status,
      })
      .select('id')
      .single(),
  )
  if (exercises.length) {
    must(
      await user.client.from('session_exercises').insert(
        exercises.map((e) => ({
          session_id: s.id,
          program_exercise_id: e.slot,
          status: e.status,
        })),
      ),
    )
  }
  return s.id as string
}

/** The calendar cell for a date, moving to the previous month if needed. */
async function calendarCell(page: Page, date: string, today: string) {
  if (date.slice(0, 7) !== today.slice(0, 7)) {
    await page.getByRole('button', { name: 'Previous month' }).click()
  }
  const cell = page.locator(`a[href="/history/${date}"]`)
  await cell.waitFor()
  return cell
}

export default suite(
  'e2e-home',
  {
    async 'finished = green even with a skipped exercise; only a day-skip is red'() {
      const today = zonedDateKey(ZONE)
      const monday = weekBounds(today).start
      const week = DAYS.map((_, i) => dateKey(addDays(parseDateKey(monday), i)))
      const yesterday = dateKey(addDays(parseDateKey(today), -1))

      const user = await newUser('homecolours')
      const seeded = await seedProgram(user, {
        days: {
          monday: { title: 'Back & Biceps', exercises: ['Lat Pulldown'] },
          tuesday: { title: 'Chest & Tri', exercises: ['Barbell Bench Press'] },
          wednesday: {
            title: 'Shoulders & Legs',
            exercises: ['Leg Press', 'Dumbbell Lateral Raise'],
          },
          thursday: { exercises: ['Leg Press'] },
          friday: { exercises: ['Leg Press'] },
          saturday: { exercises: ['Leg Press'] },
          sunday: { exercises: ['Leg Press'] },
        },
      })
      const [legPress, lateral] = seeded.programExerciseIds.wednesday
      // Monday's slot ran Wednesday's workout (a flexible day), finished with
      // one exercise skipped. Tuesday was skipped whole. Wednesday is open.
      await session(user, seeded.dayIds.wednesday, week[0], 'completed', [
        { slot: legPress, status: 'completed' },
        { slot: lateral, status: 'skipped' },
      ])
      await session(user, seeded.dayIds.tuesday, week[1], 'skipped')
      await session(user, seeded.dayIds.monday, week[2], 'in_progress')

      const ctx = await phoneContext({ timeZone: ZONE })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)

        const bar = page.getByRole('img', { name: /Mon:/ })
        const label = (await bar.getAttribute('aria-label')) ?? ''
        assert.match(label, /Mon: Completed \(Shoulders & Legs\)/)
        assert.match(label, /Tue: Skipped \(Chest & Tri\)/)
        assert.match(label, /Wed: In progress \(Back & Biceps\)/)

        const initials = await page
          .getByTestId('week-initials')
          .locator('span')
          .allTextContents()
        assert.deepEqual(initials.slice(0, 3), ['SL', 'CT', 'BB'])

        const cls = async (date: string) =>
          (await (
            await calendarCell(page, date, today)
          ).getAttribute('class')) ?? ''
        // Week dates may fall in the previous month only for the Monday-side
        // days, which are checked before any month navigation.
        if (week[0].slice(0, 7) === today.slice(0, 7)) {
          assert.match(await cls(week[0]), /bg-success/)
        }
        if (week[1].slice(0, 7) === today.slice(0, 7)) {
          assert.match(await cls(week[1]), /bg-danger/)
        }
        if (week[2].slice(0, 7) === today.slice(0, 7)) {
          const open = await cls(week[2])
          assert.doesNotMatch(open, /bg-danger|bg-success/)
        }
        // A past day nobody logged is neutral, never red.
        if (!week.includes(yesterday)) {
          const missed = await cls(yesterday)
          assert.doesNotMatch(missed, /bg-danger|bg-success/)
        }
      } finally {
        await ctx.close()
      }
    },

    async 'a logged day opens read-only, and Edit → Done returns to it'() {
      const user = await newUser('homedetail')
      sql(
        `insert into public.profiles (id, weight_unit) values ('${user.id}', 'lbs')`,
      )
      const seeded = await seedProgram(user, {
        days: {
          monday: {
            title: 'Pull',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
        },
      })
      const [lat, curl] = seeded.programExerciseIds.monday
      const id = await session(
        user,
        seeded.dayIds.monday,
        '2026-09-07',
        'completed',
        [
          { slot: lat, status: 'completed' },
          { slot: curl, status: 'skipped' },
        ],
      )
      const latSe = sql(`select id from public.session_exercises
        where session_id = '${id}' and program_exercise_id = '${lat}'`)[0][0]
      sql(`update public.session_exercises set comment = 'Strong today' where id = '${latSe}';
           insert into public.sets (session_exercise_id, set_number, reps_done, weight)
           values ('${latSe}', 1, 10, 61.23496995);`)

      const ctx = await phoneContext({ timeZone: ZONE })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/history/2026-09-07`)
        await page.getByRole('heading', { name: 'Pull' }).waitFor()
        const text = (await page.locator('main').last().textContent()) ?? ''
        assert.match(text, /1 of 2/)
        assert.match(text, /135 lbs/)
        assert.match(text, /10 reps/)
        assert.match(text, /Strong today/)
        assert.match(text, /Skipped/)
        assert.equal(
          await page.getByRole('button', { name: 'Add Set' }).count(),
          0,
        )

        await page.getByRole('link', { name: 'Edit logged workout' }).click()
        await page.getByRole('button', { name: 'Add Set' }).waitFor()
        await keypad(page, '6', '100')
        await page.getByRole('button', { name: 'Add Set' }).click()
        await page.getByText('100 lbs').waitFor()
        await page.getByRole('link', { name: 'Done Editing' }).click()
        await page.waitForURL(`${APP_URL}/history/2026-09-07`)
        await page.getByRole('link', { name: 'Edit logged workout' }).waitFor()
        assert.match(
          (await page.locator('main').last().textContent()) ?? '',
          /100 lbs/,
        )

        const stored = Number(
          sql(`select weight from public.sets where session_exercise_id = '${latSe}'
               and set_number = 2`)[0][0],
        )
        assert.ok(Math.abs(stored - 45.359237) < 1e-9, `stored ${stored}`)
      } finally {
        await ctx.close()
      }
    },

    async 'an empty past day still opens the backfill flow'() {
      const user = await newUser('homebackfill')
      await seedProgram(user, {
        days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
      })
      const ctx = await phoneContext({ timeZone: ZONE })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/history/2026-09-07`)
        await page.getByText('Not Logged').waitFor()
        assert.equal(
          await page.getByRole('link', { name: 'Edit logged workout' }).count(),
          0,
        )
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
