/**
 * Pre-push audit, items 2–4, at the database layer (PostgREST + RLS, exactly
 * what the app's own Supabase client talks to).
 *
 *   2. Workout tables: user B cannot write into user A's session by any route
 *      — insert, update, move a row across, or upsert onto an existing id.
 *   3. The catalog is SELECT-only for authenticated, in policy and in grants.
 *   4. The ON DELETE rules that decide whether history survives template edits.
 */
import assert from 'node:assert/strict'

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

let a: TestUser
let b: TestUser
let aIds: {
  day: string
  slot: string
  session: string
  se: string
  set: string
}
let bIds: {
  day: string
  slot: string
  session: string
  se: string
  set: string
}

async function seedLoggedDay(user: TestUser) {
  const seeded = await seedProgram(user, {
    days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
  })
  const slot = seeded.programExerciseIds.monday[0]
  const session = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: seeded.dayIds.monday,
        session_date: '2026-09-07',
        status: 'in_progress',
      })
      .select('id')
      .single(),
  ).id as string
  const se = must(
    await user.client
      .from('session_exercises')
      .insert({ session_id: session, program_exercise_id: slot })
      .select('id')
      .single(),
  ).id as string
  const set = must(
    await user.client
      .from('sets')
      .insert({
        session_exercise_id: se,
        set_number: 1,
        reps_done: 8,
        weight: 60,
      })
      .select('id')
      .single(),
  ).id as string
  return { day: seeded.dayIds.monday, slot, session, se, set }
}

const WORKOUT_TABLES = ['sessions', 'session_exercises', 'sets']

export default suite(
  'v2-audit-db',
  {
    'every workout table has one ALL policy whose WITH CHECK pins auth.uid()'() {
      for (const table of WORKOUT_TABLES) {
        const rows =
          sql(`select cmd, roles::text, regexp_replace(with_check, '[[:space:]]+', ' ', 'g') from pg_policies
          where schemaname = 'public' and tablename = '${table}'`)
        assert.equal(rows.length, 1, `${table}: expected exactly one policy`)
        const [cmd, roles, check] = rows[0]
        assert.equal(cmd, 'ALL')
        assert.equal(roles, '{authenticated}')
        assert.match(check, /user_id = \( SELECT auth\.uid\(\)/, table)
      }
      assert.equal(
        sqlValue(`select count(*) from pg_class where relname in
          ('sessions','session_exercises','sets') and relnamespace = 'public'::regnamespace
          and relrowsecurity`),
        '3',
      )
    },

    async 'B cannot insert a session as A, or hand B’s own session to A'() {
      const { error: insertError } = await b.client.from('sessions').insert({
        user_id: a.id,
        session_date: '2026-09-09',
        status: 'skipped',
      })
      assert.ok(insertError, 'insert as A accepted')
      const { error: moveError } = await b.client
        .from('sessions')
        .update({ user_id: a.id })
        .eq('id', bIds.session)
      assert.ok(moveError, 'reassigning own session to A accepted')
    },

    async 'B cannot add an exercise row or a set to A’s session'() {
      const { error: seError } = await b.client
        .from('session_exercises')
        .insert({ session_id: aIds.session, program_exercise_id: bIds.slot })
      assert.ok(seError, 'session_exercise into A’s session accepted')
      const { error: setError } = await b.client
        .from('sets')
        .insert({
          session_exercise_id: aIds.se,
          set_number: 2,
          reps_done: 1,
          weight: 1,
        })
      assert.ok(setError, 'set into A’s session accepted')
    },

    async 'B cannot move B’s own rows across into A’s session'() {
      const { error: seMove } = await b.client
        .from('session_exercises')
        .update({ session_id: aIds.session })
        .eq('id', bIds.se)
      assert.ok(seMove, 'moving a session_exercise into A’s session accepted')
      const { error: setMove } = await b.client
        .from('sets')
        .update({ session_exercise_id: aIds.se })
        .eq('id', bIds.set)
      assert.ok(setMove, 'moving a set into A’s session accepted')
    },

    async 'B’s updates, deletes and id-collision upserts leave A untouched'() {
      await b.client.from('sets').update({ weight: 999 }).eq('id', aIds.set)
      await b.client
        .from('session_exercises')
        .update({ status: 'skipped' })
        .eq('id', aIds.se)
      await b.client
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', aIds.session)
      await b.client.from('sets').delete().eq('id', aIds.set)
      // The live logger's write: upsert with ignoreDuplicates, on A's set id.
      await b.client
        .from('sets')
        .upsert(
          {
            id: aIds.set,
            session_exercise_id: bIds.se,
            set_number: 1,
            reps_done: 1,
            weight: 1,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      await b.client
        .from('sets')
        .upsert(
          {
            id: aIds.set,
            session_exercise_id: aIds.se,
            set_number: 1,
            reps_done: 1,
            weight: 1,
          },
          { onConflict: 'id' },
        )
    },

    'after every attempt above, A’s data is byte-for-byte unchanged'() {
      // Checked last; the fingerprint was taken in setup.
      assert.equal(dbFingerprint(a.id), aBefore)
    },

    'catalog policies are SELECT-only and write privileges are revoked'() {
      for (const table of ['categories', 'subcategories', 'exercises']) {
        const cmds = sql(`select cmd from pg_policies
          where schemaname = 'public' and tablename = '${table}'`).map(
          (r) => r[0],
        )
        assert.deepEqual(cmds, ['SELECT'], table)
        const writes =
          sqlValue(`select count(*) from information_schema.role_table_grants
          where grantee = 'authenticated' and table_schema = 'public' and table_name = '${table}'
            and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')`)
        assert.equal(writes, '0', table)
      }
    },

    'ON DELETE: logs restrict slot deletion; a deleted day nulls the session'() {
      const rule = (name: string) =>
        sqlValue(
          `select confdeltype from pg_constraint where conname = '${name}'`,
        )
      assert.equal(rule('session_exercises_program_exercise_id_fkey'), 'r') // RESTRICT
      assert.equal(rule('sessions_program_day_id_fkey'), 'n') // SET NULL
      assert.equal(rule('program_exercises_program_day_id_fkey'), 'c') // CASCADE
      assert.equal(rule('session_exercises_exercise_id_fkey'), 'r') // RESTRICT
    },

    async 'deleting a logged slot or its day is refused; history survives'() {
      const { error: slotError } = await a.client
        .from('program_exercises')
        .delete()
        .eq('id', aIds.slot)
      assert.ok(slotError, 'logged slot was deleted')
      const { error: dayError } = await a.client
        .from('program_days')
        .delete()
        .eq('id', aIds.day)
      assert.ok(dayError, 'day with a logged slot was deleted')
      assert.equal(
        sqlValue(`select count(*) from public.sets where id = '${aIds.set}'`),
        '1',
      )
    },

    async 'a skipped day’s session survives its template day being deleted'() {
      const day = sqlValue(`select d.id from public.program_days d
        join public.programs p on p.id = d.program_id
        where p.user_id = '${a.id}' and d.day_of_week = 'tuesday'`)
      const skipped = must(
        await a.client
          .from('sessions')
          .insert({
            user_id: a.id,
            program_day_id: day,
            session_date: '2026-09-08',
            status: 'skipped',
          })
          .select('id')
          .single(),
      ).id as string
      must(await a.client.from('program_days').delete().eq('id', day))
      assert.equal(
        sqlValue(`select status || ',' || coalesce(program_day_id::text, 'null')
          from public.sessions where id = '${skipped}'`),
        'skipped,null',
      )
      // Re-take the fingerprint: this test changed A on purpose.
      aBefore = dbFingerprint(a.id)
    },
  },
  {
    async setup() {
      a = await newUser('auditA')
      b = await newUser('auditB')
      aIds = await seedLoggedDay(a)
      bIds = await seedLoggedDay(b)
      aBefore = dbFingerprint(a.id)
    },
  },
)

let aBefore = ''
