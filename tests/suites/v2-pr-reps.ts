/**
 * Batch D item 1 — personal records for exercises done without weight
 * (migration 20261013130000), and compatibility with the build that is live
 * while it deploys.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

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
let slots: Record<string, string>
let dayId: string

type Row = {
  exercise_name: string
  category_name: string
  category_sort_order: number
  weight_kg: number | null
  reps: number | null
  achieved_on: string
  pr_kind: 'weight' | 'reps'
}

/** A completed (or other) session for A with sets on named exercises. */
async function log(
  user: TestUser,
  date: string,
  sets: { name: string; reps: number | null; weight: number | null }[],
  status = 'completed',
) {
  const s = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: user === a ? dayId : null,
        session_date: date,
        status,
      })
      .select('id')
      .single(),
  )
  const names = [...new Set(sets.map((x) => x.name))]
  const ses = must(
    await user.client
      .from('session_exercises')
      .insert(
        names.map((n) => ({
          session_id: s.id,
          program_exercise_id: user === a ? slots[n] : null,
          exercise_id: sqlValue(
            `select id from public.exercises where name = '${n}' limit 1`,
          ),
          status: 'completed',
        })),
      )
      .select('id, exercise_id'),
  )
  const seByName = new Map(
    names.map((n) => [
      n,
      ses.find(
        (r) =>
          r.exercise_id ===
          sqlValue(
            `select id from public.exercises where name = '${n}' limit 1`,
          ),
      )!.id,
    ]),
  )
  must(
    await user.client.from('sets').insert(
      sets.map((x, i) => ({
        session_exercise_id: seByName.get(x.name),
        set_number: i + 1,
        reps_done: x.reps,
        weight: x.weight,
      })),
    ),
  )
  return s.id as string
}

async function records(client = a.client, args: Record<string, unknown> = {}) {
  return must(
    await client.rpc('exercise_prs', { p_include_reps: true, ...args }),
  ) as Row[]
}

const one = (rows: Row[], name: string) =>
  rows.find((r) => r.exercise_name === name)

export default suite(
  'v2-pr-reps',
  {
    async 'a weighted exercise keeps its weight record'() {
      const r = one(await records(), 'Lat Pulldown')!
      assert.deepEqual(
        [r.pr_kind, Number(r.weight_kg), r.reps, r.achieved_on],
        ['weight', 60, 8, '2026-09-01'],
      )
    },

    async 'no-weight sets (null) give a reps record: most reps, earliest on ties'() {
      const r = one(await records(), 'Cable Lateral Raise')!
      assert.deepEqual(
        [r.pr_kind, r.weight_kg, r.reps, r.achieved_on],
        ['reps', null, 17, '2026-09-02'],
      )
    },

    async 'weight 0 counts as no weight'() {
      const r = one(await records(), 'Push-Ups')!
      assert.deepEqual([r.pr_kind, r.reps], ['reps', 30])
    },

    async 'mixed: any weighted set makes it a weight record'() {
      // Hanging Leg Raise: 25 bodyweight reps, and one set with 5 kg.
      const r = one(await records(), 'Hanging Leg Raise')!
      assert.deepEqual(
        [r.pr_kind, Number(r.weight_kg), r.reps],
        ['weight', 5, 10],
      )
    },

    async 'unfinished sessions never count'() {
      // An in-progress session holds 99 reps of Cable Lateral Raise.
      assert.equal(one(await records(), 'Cable Lateral Raise')!.reps, 17)
    },

    async 'excluding the live session works for reps records too'() {
      // Excluding the 2026-09-02 session (17 reps) leaves the tie on 09-03.
      const first = sqlValue(`select id from public.sessions
        where user_id = '${a.id}' and session_date = '2026-09-02'`)
      const r = one(
        await records(a.client, { p_exclude_session: first }),
        'Cable Lateral Raise',
      )!
      assert.deepEqual([r.reps, r.achieved_on], [17, '2026-09-03'])
    },

    async 'the live build’s exact calls get weight records only, same columns'() {
      // d07e305 (live while this deploys), src/lib/prs.ts:
      //   supabase.rpc('exercise_prs', { p_names, p_exclude_session })
      //   supabase.rpc('exercise_prs')
      // and it maps weight_kg with Number() — a reps row would show "PR 0 kg".
      const named = must(
        await a.client.rpc('exercise_prs', {
          p_names: ['Lat Pulldown', 'Cable Lateral Raise', 'Push-Ups'],
          p_exclude_session: null,
        }),
      ) as Row[]
      assert.deepEqual(
        named.map((r) => r.exercise_name),
        ['Lat Pulldown'],
      )
      const all = must(await a.client.rpc('exercise_prs')) as Row[]
      assert.ok(
        all.every((r) => r.pr_kind === 'weight' && Number(r.weight_kg) > 0),
      )
      // Every column the old build reads is still there, under the same name.
      for (const col of [
        'exercise_name',
        'category_name',
        'category_sort_order',
        'weight_kg',
        'reps',
        'achieved_on',
      ]) {
        assert.ok(col in all[0], `missing ${col}`)
      }
    },

    async 'user B sees none of A’s records; anon cannot call it'() {
      assert.deepEqual(await records(b.client), [])
      const { error } = await anonClient().rpc('exercise_prs', {
        p_include_reps: true,
      })
      assert.ok(error)
    },

    'still SECURITY INVOKER, EXECUTE for authenticated only, one function'() {
      assert.deepEqual(
        sql(`select prosecdef::text, pg_get_function_identity_arguments(oid)
          from pg_proc where proname = 'exercise_prs'`),
        [
          [
            'false',
            'p_names text[], p_exclude_session uuid, p_include_reps boolean',
          ],
        ],
      )
      assert.equal(
        sqlValue(`select string_agg(grantee, ',' order by grantee)
          from information_schema.routine_privileges
          where routine_name = 'exercise_prs' and grantee <> 'postgres'`),
        'authenticated',
      )
    },

    async 'the migration re-runs cleanly'() {
      const file = path.resolve(
        __dirname,
        '../../supabase/migrations/20261013130000_pr_reps_records.sql',
      )
      sql(readFileSync(file, 'utf8'))
      sql(readFileSync(file, 'utf8'))
      assert.equal(one(await records(), 'Cable Lateral Raise')!.reps, 17)
    },
  },
  {
    async setup() {
      a = await newUser('prrepsA')
      b = await newUser('prrepsB')
      const names = [
        'Lat Pulldown',
        'Cable Lateral Raise',
        'Push-Ups',
        'Hanging Leg Raise',
      ]
      const seeded = await seedProgram(a, {
        days: { monday: { title: 'Mix', exercises: names } },
      })
      dayId = seeded.dayIds.monday
      slots = Object.fromEntries(
        names.map((n, i) => [n, seeded.programExerciseIds.monday[i]]),
      )
      await log(a, '2026-09-01', [
        { name: 'Lat Pulldown', reps: 8, weight: 60 },
        { name: 'Cable Lateral Raise', reps: 12, weight: null },
        { name: 'Push-Ups', reps: 30, weight: 0 },
        { name: 'Hanging Leg Raise', reps: 25, weight: null },
      ])
      await log(a, '2026-09-02', [
        { name: 'Cable Lateral Raise', reps: 17, weight: null },
        { name: 'Hanging Leg Raise', reps: 10, weight: 5 },
      ])
      await log(a, '2026-09-03', [
        { name: 'Cable Lateral Raise', reps: 17, weight: null }, // tie: later
      ])
      await log(
        a,
        '2026-09-04',
        [{ name: 'Cable Lateral Raise', reps: 99, weight: null }],
        'in_progress',
      )
    },
  },
)
