/**
 * Pre-push audit, item 4: what happens to past logs when the Split changes,
 * driven through the real saveProgram Server Action as a signed-in user.
 *
 * Days are never deleted by the app (a split always has seven day rows); a day
 * is "removed" by emptying it or marking it rest, which means removing its
 * exercises. So the question is what removing a logged exercise does — since
 * migration 20261012120000, it succeeds and the log keeps its own snapshot.
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

/** Every logged set of the session; unaffected by slot changes. */
function setsFingerprint() {
  return sqlValue(`select md5(string_agg(row(t.*)::text, '|' order by t.id))
    from public.sets t join public.session_exercises e on e.id = t.session_exercise_id
    where e.session_id = '${doneSession}'`)
}

export default suite(
  'e2e-split-history',
  {
    // Runs first, while both logged slots still exist.
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

    async 'an invalid draft is refused and changes nothing'() {
      // The atomicity guarantee from the pre-push audit: a refusal must not be
      // half applied. Before migration 20261012120000 this was exercised by the
      // logged-history refusal, which no longer exists; validation is the
      // remaining refusal path.
      const before = dbFingerprint(user.id)
      const draft = currentDraft()
      draft.find((d) => d.day_of_week === 'monday')!.title = 'x'.repeat(61)
      draft.find((d) => d.day_of_week === 'tuesday')!.is_rest_day = true
      const result = await save(draft)
      assert.equal(result.ok, false)
      assert.equal(
        dbFingerprint(user.id),
        before,
        'a refused save changed data',
      )
    },

    async 'removing a logged exercise works, and its history stays intact'() {
      // CHANGED (migration 20261012120000, ON DELETE SET NULL). Previously:
      //   assert.equal(result.ok, false)
      //   assert.match(result.error, /Lat Pulldown has logged workout history/)
      //   assert.equal(logsFingerprint(), before)       // log rows untouched
      //   assert.equal(<slot count>, '1')               // slot kept
      // Now the removal succeeds; the slot goes, and the log keeps everything
      // except its link back to the slot.
      const setsBefore = setsFingerprint()
      const draft = currentDraft()
      const monday = draft.find((d) => d.day_of_week === 'monday')!
      monday.exercises = monday.exercises.slice(1) // drop the first slot
      const result = await save(draft)
      assert.equal(result.ok, true, result.error)
      assert.equal(
        sqlValue(`select count(*) from public.program_exercises
          where id = '${seeded.programExerciseIds.monday[0]}'`),
        '0',
      )
      assert.equal(
        sqlValue(`select coalesce(se.program_exercise_id::text, 'null') || ',' ||
            e.name || ',' || se.exercise_order || ',' || se.prescribed_reps
          from public.session_exercises se join public.exercises e on e.id = se.exercise_id
          where se.session_id = '${doneSession}' and se.exercise_order = 1`),
        'null,Lat Pulldown,1,3x10',
      )
      assert.equal(setsFingerprint(), setsBefore, 'logged sets changed')

      const page = await ctx.newPage()
      await page.goto(`${APP_URL}/history/2026-09-07`)
      const text = (await page.locator('main').last().textContent()) ?? ''
      assert.match(text, /Lat Pulldown/)
      // CHANGED in V2 Phase 3: the day opens in the read-only detail view,
      // which lists weight and reps in their own columns. Previously (editor):
      //   assert.match(text, /10 × 55 kg/)
      assert.match(text, /55 kg/)
      assert.match(text, /10 reps/)
      await page.close()
    },

    async 'turning a logged day into an empty rest day works; its log survives'() {
      // CHANGED (migration 20261012120000). Previously:
      //   assert.equal(result.ok, false)
      //   assert.equal(dbFingerprint(user.id), before)  // nothing changed
      // Now the day becomes a rest day and its remaining slot is removed, while
      // the session and every logged row stay, still tied to the day.
      const draft = currentDraft()
      const monday = draft.find((d) => d.day_of_week === 'monday')!
      monday.is_rest_day = true
      monday.exercises = []
      const result = await save(draft)
      assert.equal(result.ok, true, result.error)
      assert.equal(
        sqlValue(`select is_rest_day from public.program_days
          where id = '${seeded.dayIds.monday}'`),
        't',
      )
      assert.equal(
        sqlValue(`select s.program_day_id || ',' || count(se.*) || ',' ||
            count(*) filter (where se.program_exercise_id is null)
          from public.sessions s join public.session_exercises se on se.session_id = s.id
          where s.id = '${doneSession}' group by s.program_day_id`),
        `${seeded.dayIds.monday},2,2`,
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
        await user.client.from('sets').insert({
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
