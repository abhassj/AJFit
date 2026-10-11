/**
 * Pre-push audit, item 4: what happens to past logs when the Split changes,
 * driven through the real saveProgram Server Action as a signed-in user.
 *
 * Days are never deleted by the app (a split always has seven day rows); a day
 * is "removed" by emptying it or marking it rest, which means removing its
 * exercises. So the question is what removing a logged exercise does.
 */
import assert from 'node:assert/strict'

import type { BrowserContext } from '@playwright/test'

import { callAs, manifestActions, resultOf } from '../lib/actions'
import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  dbFingerprint,
  must,
  newUser,
  seedProgram,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'

let user: TestUser
let ctx: BrowserContext
let seeded: Awaited<ReturnType<typeof seedProgram>>
let doneSession: string

type Draft = {
  day_of_week: string
  title: string
  is_rest_day: boolean
  exercises: {
    id?: string
    exercise_id: string
    prescribed_reps: string
    rest_seconds: number | null
    custom_fields: Record<string, string>
  }[]
}

/** The saved split, shaped as the builder would submit it. */
function currentDraft(): Draft[] {
  const days = sql(`select d.day_of_week, coalesce(d.title, ''), d.is_rest_day
    from public.program_days d join public.programs p on p.id = d.program_id
    where p.user_id = '${user.id}'`)
  return days.map(([dow, title, rest]) => ({
    day_of_week: dow,
    title,
    is_rest_day: rest === 't',
    exercises: sql(`select x.id, x.exercise_id, coalesce(x.prescribed_reps, '')
      from public.program_exercises x join public.program_days d on d.id = x.program_day_id
      join public.programs p on p.id = d.program_id
      where p.user_id = '${user.id}' and d.day_of_week = '${dow}'
      order by x.exercise_order`).map(([id, exercise_id, reps]) => ({
      id,
      exercise_id,
      prescribed_reps: reps,
      rest_seconds: null,
      custom_fields: {},
    })),
  }))
}

async function save(draft: Draft[]) {
  const action = manifestActions().find((x) => x.name === 'saveProgram')!
  const res = await callAs(ctx.request, action, ['Test Split', draft])
  return resultOf(res.body)
}

function logsFingerprint() {
  return sqlValue(`select md5(string_agg(row(e.*)::text || coalesce(row(t.*)::text, ''), '|'
      order by e.id, t.id))
    from public.session_exercises e left join public.sets t on t.session_exercise_id = e.id
    where e.session_id = '${doneSession}'`)
}

export default suite(
  'e2e-split-history',
  {
    async 'removing a logged exercise is refused, and its logs survive'() {
      const before = logsFingerprint()
      const draft = currentDraft()
      const monday = draft.find((d) => d.day_of_week === 'monday')!
      monday.exercises = monday.exercises.slice(1) // drop Lat Pulldown
      const result = await save(draft)
      assert.equal(result.ok, false)
      assert.match(
        result.error ?? '',
        /Lat Pulldown has logged workout history/,
      )
      assert.equal(logsFingerprint(), before)
      assert.equal(
        sqlValue(`select count(*) from public.program_exercises
          where id = '${seeded.programExerciseIds.monday[0]}'`),
        '1',
      )
    },

    async 'turning a logged day into an empty rest day is refused too'() {
      const before = dbFingerprint(user.id)
      const draft = currentDraft()
      const monday = draft.find((d) => d.day_of_week === 'monday')!
      monday.is_rest_day = true
      monday.exercises = []
      const result = await save(draft)
      assert.equal(result.ok, false)
      assert.equal(
        dbFingerprint(user.id),
        before,
        'a refused save changed data',
      )
    },

    async 'removing an exercise that was never logged works'() {
      const draft = currentDraft()
      draft.find((d) => d.day_of_week === 'tuesday')!.exercises = []
      const result = await save(draft)
      assert.equal(result.ok, true, result.error)
      assert.equal(
        sqlValue(`select count(*) from public.program_exercises
          where id = '${seeded.programExerciseIds.tuesday[0]}'`),
        '0',
      )
    },

    async 'swapping a logged slot’s exercise leaves history naming the old one'() {
      const before = logsFingerprint()
      const draft = currentDraft()
      const slot = draft.find((d) => d.day_of_week === 'monday')!.exercises[0]
      slot.exercise_id = sqlValue(
        "select id from public.exercises where name = 'Neutral-Grip Cable Pulldown'",
      )!
      const result = await save(draft)
      assert.equal(result.ok, true, result.error)
      assert.equal(logsFingerprint(), before)

      const page = await ctx.newPage()
      await page.goto(`${APP_URL}/history/2026-09-07`)
      const text = (await page.locator('main').last().textContent()) ?? ''
      assert.match(text, /Lat Pulldown/)
      assert.doesNotMatch(text, /Neutral-Grip Cable Pulldown/)
      await page.close()
    },
  },
  {
    async setup() {
      user = await newUser('splithist')
      seeded = await seedProgram(user, {
        days: {
          monday: {
            title: 'Pull',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
          tuesday: { title: 'Legs', exercises: ['Leg Press'] },
        },
      })
      doneSession = must(
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
      ).id as string
      const ses = must(
        await user.client
          .from('session_exercises')
          .insert(
            seeded.programExerciseIds.monday.map((id) => ({
              session_id: doneSession,
              program_exercise_id: id,
              status: 'completed',
            })),
          )
          .select('id, program_exercise_id'),
      )
      const lat = ses.find(
        (r) => r.program_exercise_id === seeded.programExerciseIds.monday[0],
      )!
      must(
        await user.client
          .from('sets')
          .insert({
            session_exercise_id: lat.id,
            set_number: 1,
            reps_done: 10,
            weight: 55,
          }),
      )
      ctx = await phoneContext()
      const page = await ctx.newPage()
      await signIn(page, user)
      await page.close()
    },
    async teardown() {
      await ctx?.close()
      await closeBrowser()
    },
  },
)
