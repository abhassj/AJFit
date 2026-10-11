/**
 * V2 Phase 2.1 — the weekly lock (decision D6), in three timezones.
 *
 * A day with a COMPLETED session in the viewer's current Mon–Sun week is shown
 * green ("Done · Mon") and cannot be started again; one completed last Sunday
 * is not locked (the week turned over on Monday in the viewer's zone); a
 * skipped day never locks. The server refuses a start on a locked day even
 * when the page did not know.
 */
import assert from 'node:assert/strict'

import { callAs, manifestActions, resultOf } from '../lib/actions'
import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  must,
  newUser,
  seedProgram,
  sqlValue,
  type TestUser,
} from '../lib/local'
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
] as const

async function addSession(
  user: TestUser,
  dayId: string,
  date: string,
  status: 'completed' | 'skipped',
) {
  must(
    await user.client.from('sessions').insert({
      user_id: user.id,
      program_day_id: dayId,
      session_date: date,
      status,
    }),
  )
}

async function lockScenario(zone: string) {
  const today = zonedDateKey(zone)
  const todayDow = DAYS[(parseDateKey(today).getDay() + 6) % 7]
  const { start } = weekBounds(today)
  // A session dated today would turn /start into today's summary, so on a
  // Monday the in-week completion is dated tomorrow instead. Same week.
  const inWeek =
    today === start ? dateKey(addDays(parseDateKey(start), 1)) : start
  const lastSunday = dateKey(addDays(parseDateKey(start), -1))

  // The locked day is never today's, so today's own workout stays startable.
  const lockedDow = todayDow === 'tuesday' ? 'wednesday' : 'tuesday'
  const lastWeekDow = lockedDow === 'wednesday' ? 'thursday' : 'wednesday'
  const skippedDow = 'friday' === todayDow ? 'saturday' : 'friday'

  const user = await newUser('lock')
  const seeded = await seedProgram(user, {
    days: Object.fromEntries(
      DAYS.map((d) => [d, { title: `T-${d}`, exercises: ['Lat Pulldown'] }]),
    ),
  })
  await addSession(user, seeded.dayIds[lockedDow], inWeek, 'completed')
  await addSession(user, seeded.dayIds[lastWeekDow], lastSunday, 'completed')
  await addSession(user, seeded.dayIds[skippedDow], inWeek, 'skipped')

  const ctx = await phoneContext({ timeZone: zone })
  const page = await ctx.newPage()
  try {
    await signIn(page, user)
    await page.goto(`${APP_URL}/start`)
    await page.getByRole('button', { name: /different day/ }).click()

    const row = (dow: string) =>
      page.getByRole('button', { name: new RegExp(`T-${dow}`) })
    const doneLabel = `Done · ${new Date(`${inWeek}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}`

    assert.match(
      (await row(lockedDow).textContent()) ?? '',
      new RegExp(doneLabel),
    )
    assert.equal(await row(lockedDow).isDisabled(), true, 'locked day pickable')
    assert.doesNotMatch((await row(lastWeekDow).textContent()) ?? '', /Done/)
    assert.equal(await row(lastWeekDow).isDisabled(), false, 'last week locked')
    assert.doesNotMatch((await row(skippedDow).textContent()) ?? '', /Done/)
    assert.equal(
      await row(skippedDow).isDisabled(),
      false,
      'skipped day locked',
    )

    // A stale tab that still offers the locked day: the server refuses it.
    const start = manifestActions().find((x) => x.name === 'startSession')!
    const res = await callAs(ctx.request, start, [seeded.dayIds[lockedDow]])
    assert.match(resultOf(res.body).error ?? '', /already done this week/)
    assert.equal(
      sqlValue(`select count(*) from public.sessions
        where user_id = '${user.id}' and status = 'in_progress'`),
      '0',
    )
  } finally {
    await ctx.close()
  }
}

export default suite(
  'e2e-start-lock',
  {
    async 'Asia/Kolkata: this week locks, last week and skips do not'() {
      await lockScenario('Asia/Kolkata')
    },

    async 'Europe/London: this week locks, last week and skips do not'() {
      await lockScenario('Europe/London')
    },

    async 'Asia/Muscat: this week locks, last week and skips do not'() {
      await lockScenario('Asia/Muscat')
    },

    async 'today’s own workout, once done this week, shows Done and cannot start'() {
      const zone = 'Asia/Kolkata'
      const today = zonedDateKey(zone)
      const todayDow = DAYS[(parseDateKey(today).getDay() + 6) % 7]
      const { start, end } = weekBounds(today)
      // Done earlier this week, or later (dated ahead) when today is Monday.
      const doneOn = today === start ? end : start
      const user = await newUser('locktoday')
      const seeded = await seedProgram(user, {
        days: Object.fromEntries(
          DAYS.map((d) => [
            d,
            { title: `T-${d}`, exercises: ['Lat Pulldown'] },
          ]),
        ),
      })
      await addSession(user, seeded.dayIds[todayDow], doneOn, 'completed')

      const ctx = await phoneContext({ timeZone: zone })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/start`)
        const banner = page.getByRole('link', { name: /Done ·/ })
        await banner.waitFor()
        assert.equal(await banner.getAttribute('href'), `/history/${doneOn}`)
        assert.equal(
          await page
            .getByRole('button', { name: 'Start Workout' })
            .isDisabled(),
          true,
        )
      } finally {
        await ctx.close()
      }
    },

    async 'every training day done shows Week Complete'() {
      const zone = 'Asia/Kolkata'
      const today = zonedDateKey(zone)
      const { start, end } = weekBounds(today)
      const user = await newUser('weekdone')
      const seeded = await seedProgram(user, {
        days: {
          monday: { title: 'Push', exercises: ['Barbell Bench Press'] },
          thursday: { title: 'Pull', exercises: ['Lat Pulldown'] },
          // The rest are empty days, which never need doing.
        },
      })
      const date = today === start ? end : start
      await addSession(user, seeded.dayIds.monday, date, 'completed')
      await addSession(user, seeded.dayIds.thursday, date, 'completed')

      const ctx = await phoneContext({ timeZone: zone })
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        await page.goto(`${APP_URL}/start`)
        await page.getByRole('heading', { name: 'Week Complete' }).waitFor()
        assert.equal(
          await page.getByRole('button', { name: 'Start Workout' }).count(),
          0,
        )
      } finally {
        await ctx.close()
      }
    },
  },
  { teardown: closeBrowser },
)
