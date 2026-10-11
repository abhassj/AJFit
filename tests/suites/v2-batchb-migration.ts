/**
 * Migration 20261012120000 must be safe while the build that is live before
 * it (99d6d4f) is still serving. That build knows nothing of the snapshot
 * columns (exercise_order, prescribed_reps) or the new RLS check, so this
 * suite talks to the database exactly the way it does — same insert shapes,
 * same embedded select — and checks the migration fills in the rest.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { suite } from '../lib/harness'
import {
  must,
  newUser,
  seedProgram,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'

let user: TestUser
let seeded: Awaited<ReturnType<typeof seedProgram>>
let sessionId: string

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20261012120000_v2_history_independent_of_split.sql',
)

/** The live build's session read (src/lib/session.ts at 99d6d4f). */
const LIVE_SESSION_SELECT = `
  id, session_date, status, start_time, end_time, paused_duration,
  session_exercises (
    id, program_exercise_id, status, completed_at, comment,
    program_exercises (
      exercise_order, prescribed_reps, rest_seconds,
      exercises ( name )
    ),
    sets ( id, set_number, reps_done, weight )
  )
`

function snapshot(seId: string) {
  return sqlValue(`select e.name || ',' || se.exercise_order || ',' || se.prescribed_reps
    from public.session_exercises se join public.exercises e on e.id = se.exercise_id
    where se.id = '${seId}'`)
}

export default suite(
  'v2-batchb-migration',
  {
    async 'live startSession insert (exercise_id, no snapshot) is filled in'() {
      // 99d6d4f start/actions.ts: session_id, program_exercise_id,
      // exercise_id, status — nothing else.
      const slot = seeded.programExerciseIds.monday[1]
      const row = must(
        await user.client
          .from('session_exercises')
          .insert({
            session_id: sessionId,
            program_exercise_id: slot,
            exercise_id: sqlValue(
              `select exercise_id from public.program_exercises where id = '${slot}'`,
            ),
            status: 'pending',
          })
          .select('id')
          .single(),
      )
      assert.equal(snapshot(row.id), 'Barbell Bicep Curl,2,3x10')
    },

    async 'live startBackfill insert (no exercise_id either) is filled in'() {
      // 99d6d4f history/actions.ts: session_id, program_exercise_id, status.
      const row = must(
        await user.client
          .from('session_exercises')
          .insert({
            session_id: sessionId,
            program_exercise_id: seeded.programExerciseIds.monday[0],
            status: 'pending',
          })
          .select('id')
          .single(),
      )
      assert.equal(snapshot(row.id), 'Lat Pulldown,1,3x10')
    },

    async 'the live build’s status update and embedded read still work'() {
      must(
        await user.client
          .from('session_exercises')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId),
      )
      const data = must(
        await user.client
          .from('sessions')
          .select(LIVE_SESSION_SELECT)
          .eq('id', sessionId)
          .single(),
      ) as unknown as {
        session_exercises: {
          status: string
          program_exercises: {
            exercise_order: number
            exercises: { name: string }
          } | null
        }[]
      }
      const names = data.session_exercises
        .map((se) => se.program_exercises?.exercises.name)
        .sort()
      assert.deepEqual(names, ['Barbell Bicep Curl', 'Lat Pulldown'])
      assert.ok(data.session_exercises.every((se) => se.status === 'completed'))
    },

    'the migration’s own backfill restores rows logged before it'() {
      // Rows written before the migration have no snapshot. Recreate that
      // state for this user's rows, then run the backfill statement taken
      // verbatim from the migration file.
      sql(`update public.session_exercises set exercise_order = null, prescribed_reps = null
           where session_id = '${sessionId}'`)
      const migration = readFileSync(MIGRATION, 'utf8')
      const start = migration.indexOf('update public.session_exercises se')
      const backfill = migration.slice(start, migration.indexOf(';', start) + 1)
      assert.match(backfill, /set exercise_order = pe\.exercise_order/)
      sql(backfill)
      assert.equal(
        sqlValue(`select string_agg(exercise_order || ':' || prescribed_reps, ','
            order by exercise_order)
          from public.session_exercises where session_id = '${sessionId}'`),
        '1:3x10,2:3x10',
      )
    },
  },
  {
    async setup() {
      user = await newUser('migB')
      seeded = await seedProgram(user, {
        days: {
          monday: {
            title: 'Pull',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
        },
      })
      sessionId = must(
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
    },
  },
)
