/**
 * V2 Phase 0 — schema groundwork: unit preferences, the exercise snapshot on
 * session_exercises, the PR function, and the unilateral Arms catalog.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  anonClient,
  must,
  newUser,
  seedProgram,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'

let a: TestUser
let b: TestUser
let seeded: Awaited<ReturnType<typeof seedProgram>>

type Pr = {
  exercise_name: string
  category_name: string
  category_sort_order: number
  weight_kg: number
  reps: number | null
  achieved_on: string
}

/** Logs a session for `a` with the given sets per program-exercise index. */
async function logSession(
  date: string,
  status: 'completed' | 'in_progress' | 'skipped',
  sets: { slot: number; reps: number | null; weight: number | null }[],
) {
  const s = must(
    await a.client
      .from('sessions')
      .insert({
        user_id: a.id,
        program_day_id: seeded.dayIds.monday,
        session_date: date,
        status,
      })
      .select('id')
      .single(),
  )
  const slots = seeded.programExerciseIds.monday
  const ses = must(
    await a.client
      .from('session_exercises')
      .insert(
        slots.map((id) => ({ session_id: s.id, program_exercise_id: id })),
      )
      .select('id, program_exercise_id'),
  )
  const bySlot = new Map(ses.map((r) => [r.program_exercise_id, r.id]))
  if (sets.length) {
    must(
      await a.client.from('sets').insert(
        sets.map((set, i) => ({
          session_exercise_id: bySlot.get(slots[set.slot]),
          set_number: i + 1,
          reps_done: set.reps,
          weight: set.weight,
        })),
      ),
    )
  }
  return s.id as string
}

async function prs(client = a.client, args: Record<string, unknown> = {}) {
  return must(await client.rpc('exercise_prs', args)) as Pr[]
}

let currentSession: string

export default suite(
  'v2-phase0-schema',
  {
    async 'profiles default to kg and cm with no height and not onboarded'() {
      must(await a.client.from('profiles').upsert({ id: a.id }))
      const row = must(
        await a.client
          .from('profiles')
          .select('weight_unit, height_unit, height_cm, onboarded_at')
          .eq('id', a.id)
          .single(),
      )
      assert.deepEqual(row, {
        weight_unit: 'kg',
        height_unit: 'cm',
        height_cm: null,
        onboarded_at: null,
      })
    },

    async 'unit and height constraints reject nonsense'() {
      for (const bad of [
        { weight_unit: 'stone' },
        { height_unit: 'm' },
        { height_cm: 20 },
        { height_cm: 400 },
      ]) {
        const { error } = await a.client
          .from('profiles')
          .update(bad)
          .eq('id', a.id)
        assert.ok(error, `accepted ${JSON.stringify(bad)}`)
      }
      must(
        await a.client
          .from('profiles')
          .update({ weight_unit: 'lbs', height_unit: 'ft', height_cm: 180.34 })
          .eq('id', a.id),
      )
      assert.equal(
        sqlValue(
          `select weight_unit || height_unit || height_cm from public.profiles where id = '${a.id}'`,
        ),
        'lbsft180.34',
      )
    },

    'session_exercises.exercise_id is NOT NULL with a RESTRICT foreign key'() {
      assert.equal(
        sqlValue(`select is_nullable from information_schema.columns
                  where table_name = 'session_exercises' and column_name = 'exercise_id'`),
        'NO',
      )
      assert.equal(
        sqlValue(`select confdeltype from pg_constraint
                  where conrelid = 'public.session_exercises'::regclass
                    and conname like '%exercise_id_fkey' and conname not like '%program%'`),
        'r',
      )
    },

    async 'an insert without exercise_id is stamped from the slot (old app path)'() {
      const id = currentSession
      const stamped = sql(`select e.name from public.session_exercises se
        join public.exercises e on e.id = se.exercise_id
        where se.session_id = '${id}' order by e.name`).map((r) => r[0])
      assert.deepEqual(stamped, [
        'Barbell Bench Press',
        'Romanian Deadlift (RDL)',
      ])
    },

    async 'swapping a slot’s exercise does not rewrite logged history'() {
      const slot = seeded.programExerciseIds.monday[0]
      const incline = sqlValue(
        "select id from public.exercises where name = 'Incline Barbell Press'",
      )
      must(
        await a.client
          .from('program_exercises')
          .update({ exercise_id: incline })
          .eq('id', slot),
      )
      assert.equal(
        sqlValue(`select count(*) from public.session_exercises se
          join public.exercises e on e.id = se.exercise_id
          where se.program_exercise_id = '${slot}' and e.name = 'Barbell Bench Press'`),
        '4',
      )
      // Put it back so later tests read naturally.
      const bench = sqlValue(
        "select id from public.exercises where name = 'Barbell Bench Press'",
      )
      must(
        await a.client
          .from('program_exercises')
          .update({ exercise_id: bench })
          .eq('id', slot),
      )
    },

    async 'PR = heaviest weight in a completed session'() {
      const bench = (await prs()).find(
        (p) => p.exercise_name === 'Barbell Bench Press',
      )
      // 100 kg in an in_progress session and 0/null weights never count.
      assert.equal(Number(bench?.weight_kg), 90)
    },

    async 'PR ties go to more reps, then the earliest date'() {
      const bench = (await prs()).find(
        (p) => p.exercise_name === 'Barbell Bench Press',
      )
      assert.equal(bench?.reps, 6)
      assert.equal(bench?.achieved_on, '2026-09-08')
    },

    async 'Romanian Deadlift has one PR shown under both Back and Legs'() {
      const rdl = (await prs()).filter(
        (p) => p.exercise_name === 'Romanian Deadlift (RDL)',
      )
      assert.deepEqual(
        rdl.map((p) => p.category_name),
        ['Back', 'Legs'],
      )
      assert.equal(new Set(rdl.map((p) => Number(p.weight_kg))).size, 1)
      assert.equal(Number(rdl[0].weight_kg), 120)
    },

    async 'PRs can be filtered by name and exclude one session'() {
      const only = await prs(a.client, { p_names: ['Romanian Deadlift (RDL)'] })
      assert.ok(
        only.every((p) => p.exercise_name === 'Romanian Deadlift (RDL)'),
      )
      const withoutBest = await prs(a.client, {
        p_names: ['Barbell Bench Press'],
        p_exclude_session: sqlValue(`select s.id from public.sessions s
          join public.session_exercises se on se.session_id = s.id
          join public.sets st on st.session_exercise_id = se.id
          where s.user_id = '${a.id}' and st.weight = 90 and st.reps_done = 6
          order by s.session_date limit 1`),
      })
      // With 2026-09-08 excluded, the 90×6 on 2026-09-09 becomes the record.
      assert.equal(withoutBest[0].achieved_on, '2026-09-09')
    },

    async 'user B sees none of user A’s PRs'() {
      assert.deepEqual(await prs(b.client), [])
    },

    async 'anon cannot execute exercise_prs'() {
      const { error } = await anonClient().rpc('exercise_prs')
      assert.ok(error)
    },

    'exercise_prs is SECURITY INVOKER and granted to authenticated only'() {
      assert.equal(
        sqlValue(
          `select prosecdef from pg_proc where proname = 'exercise_prs'`,
        ),
        'f',
      )
      const grantees =
        sql(`select grantee from information_schema.routine_privileges
        where routine_name = 'exercise_prs' and grantee <> 'postgres' order by 1`).map(
          (r) => r[0],
        )
      assert.deepEqual(grantees, ['authenticated'])
    },

    'eleven unilateral Arms exercises sit in existing Arms subcategories'() {
      const rows = sql(`select s.name, count(*) from public.exercises e
        join public.subcategories s on s.id = e.subcategory_id
        join public.categories c on c.id = s.category_id
        where c.name = 'Arms' and (e.name like 'Single-Arm%'
          or e.name in ('Concentration Curl', 'Cross-Body Hammer Curl', 'Dumbbell Tricep Kickback'))
        group by s.name, s.sort_order order by s.sort_order`)
      assert.deepEqual(rows, [
        ['Standard & Short-Head Bicep Variations', '3'],
        ['Neutral / Hammer Curl Variations', '2'],
        ['Tricep Pushdown Variations', '2'],
        ['Tricep Extension Variations', '4'],
      ])
      assert.equal(sqlValue('select count(*) from public.subcategories'), '26')
    },
  },
  {
    async setup() {
      a = await newUser('v2p0a')
      b = await newUser('v2p0b')
      seeded = await seedProgram(a, {
        days: {
          monday: {
            title: 'Push & Hinge',
            exercises: ['Barbell Bench Press', 'Romanian Deadlift (RDL)'],
          },
        },
      })
      // Slot 0 = bench, slot 1 = RDL.
      await logSession('2026-09-07', 'completed', [
        { slot: 0, reps: 8, weight: 80 },
        { slot: 0, reps: 5, weight: 90 },
        { slot: 1, reps: 5, weight: 120 },
      ])
      await logSession('2026-09-08', 'completed', [
        { slot: 0, reps: 6, weight: 90 }, // the record: ties on weight, more reps
        { slot: 0, reps: 10, weight: 0 },
        { slot: 0, reps: 12, weight: null },
      ])
      await logSession('2026-09-09', 'completed', [
        { slot: 0, reps: 6, weight: 90 },
      ])
      currentSession = await logSession('2026-09-10', 'in_progress', [
        { slot: 0, reps: 3, weight: 100 },
      ])
    },
  },
)
