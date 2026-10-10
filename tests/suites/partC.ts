/**
 * Part C — isolation between users. User B can neither see nor change anything
 * user A owns, on every user-owned table, and anon sees nothing at all.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  anonClient,
  must,
  newUser,
  seedProgram,
  sqlValue,
  type TestUser,
} from '../lib/local'

let a: TestUser
let b: TestUser
let seeded: Awaited<ReturnType<typeof seedProgram>>
let sessionId: string
let setId: string

const OWNED = [
  'profiles',
  'weight_logs',
  'programs',
  'program_days',
  'program_exercises',
  'sessions',
  'session_exercises',
  'sets',
] as const

export default suite(
  'partC',
  {
    async 'user B reads none of user A’s rows'() {
      for (const table of OWNED) {
        const rows = must(await b.client.from(table).select('*'))
        assert.equal((rows ?? []).length, 0, `${table} leaked to user B`)
      }
    },

    async 'user B cannot update user A’s sets'() {
      await b.client.from('sets').update({ weight: 999 }).eq('id', setId)
      assert.equal(
        sqlValue(`select weight from public.sets where id = '${setId}'`),
        '50',
      )
    },

    async 'user B cannot delete user A’s session'() {
      await b.client.from('sessions').delete().eq('id', sessionId)
      assert.equal(
        sqlValue(
          `select count(*) from public.sessions where id = '${sessionId}'`,
        ),
        '1',
      )
    },

    async 'user B cannot attach a session_exercise to user A’s session'() {
      const { error } = await b.client.from('session_exercises').insert({
        session_id: sessionId,
        program_exercise_id: seeded.programExerciseIds.monday[0],
      })
      assert.ok(error)
    },

    async 'user B cannot insert a session owned by user A'() {
      const { error } = await b.client.from('sessions').insert({
        user_id: a.id,
        session_date: '2026-09-01',
        status: 'skipped',
      })
      assert.ok(error)
    },

    async 'anon reads none of the user tables'() {
      const anon = anonClient()
      for (const table of OWNED) {
        const { data, error } = await anon.from(table).select('*').limit(1)
        assert.ok(error || (data ?? []).length === 0, `${table} leaked to anon`)
      }
    },
  },
  {
    async setup() {
      a = await newUser('partCa')
      b = await newUser('partCb')
      seeded = await seedProgram(a, {
        days: { monday: { exercises: ['Lat Pulldown'] } },
      })
      must(
        await a.client
          .from('profiles')
          .upsert({ id: a.id, display_name: 'A', motto: 'secret' }),
      )
      must(
        await a.client
          .from('weight_logs')
          .insert({ user_id: a.id, log_date: '2026-09-01', weight: 70 }),
      )
      const s = must(
        await a.client
          .from('sessions')
          .insert({
            user_id: a.id,
            program_day_id: seeded.dayIds.monday,
            session_date: '2026-09-07',
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      sessionId = s.id
      const se = must(
        await a.client
          .from('session_exercises')
          .insert({
            session_id: s.id,
            program_exercise_id: seeded.programExerciseIds.monday[0],
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      const set = must(
        await a.client
          .from('sets')
          .insert({
            session_exercise_id: se.id,
            set_number: 1,
            reps_done: 5,
            weight: 50,
          })
          .select('id')
          .single(),
      )
      setId = set.id
    },
  },
)
