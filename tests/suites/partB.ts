/**
 * Part B — session logging: the in_progress → completed lifecycle, sets, and
 * the whole-day skip record.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  must,
  newUser,
  seedProgram,
  sqlValue,
  type TestUser,
} from '../lib/local'

let user: TestUser
let seeded: Awaited<ReturnType<typeof seedProgram>>

async function startSession(date: string, dow: string) {
  const session = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: seeded.dayIds[dow],
        session_date: date,
        status: 'in_progress',
        start_time: new Date().toISOString(),
        paused_duration: '0 seconds',
      })
      .select('id')
      .single(),
  )
  const ses = must(
    await user.client
      .from('session_exercises')
      .insert(
        seeded.programExerciseIds[dow].map((id) => ({
          session_id: session.id,
          program_exercise_id: id,
          status: 'pending',
        })),
      )
      .select('id, program_exercise_id'),
  )
  return { sessionId: session.id as string, sessionExercises: ses }
}

export default suite(
  'partB',
  {
    async 'a session runs from in_progress to completed with sets'() {
      const { sessionId, sessionExercises } = await startSession(
        '2026-09-07',
        'monday',
      )
      const se = sessionExercises[0].id
      must(
        await user.client.from('sets').insert([
          { session_exercise_id: se, set_number: 1, reps_done: 10, weight: 40 },
          { session_exercise_id: se, set_number: 2, reps_done: 8, weight: 45 },
        ]),
      )
      must(
        await user.client
          .from('session_exercises')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', se),
      )
      must(
        await user.client
          .from('sessions')
          .update({ status: 'completed', end_time: new Date().toISOString() })
          .eq('id', sessionId),
      )

      assert.equal(
        sqlValue(
          `select status from public.sessions where id = '${sessionId}'`,
        ),
        'completed',
      )
      assert.equal(
        sqlValue(
          `select string_agg(reps_done || 'x' || weight, ',' order by set_number)
           from public.sets where session_exercise_id = '${se}'`,
        ),
        '10x40,8x45',
      )
    },

    async 'an invalid session status is rejected'() {
      const { error } = await user.client.from('sessions').insert({
        user_id: user.id,
        session_date: '2026-09-08',
        status: 'abandoned',
      })
      assert.ok(error)
    },

    async 'a whole-day skip is a session with no exercises'() {
      const s = must(
        await user.client
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: seeded.dayIds.tuesday,
            session_date: '2026-09-08',
            status: 'skipped',
          })
          .select('id')
          .single(),
      )
      assert.equal(
        sqlValue(
          `select count(*) from public.session_exercises where session_id = '${s.id}'`,
        ),
        '0',
      )
    },

    async 'paused_duration accumulates as an interval'() {
      const { sessionId } = await startSession('2026-09-09', 'monday')
      must(
        await user.client
          .from('sessions')
          .update({ paused_duration: '95 seconds' })
          .eq('id', sessionId),
      )
      assert.equal(
        sqlValue(
          `select extract(epoch from paused_duration)::int from public.sessions where id = '${sessionId}'`,
        ),
        '95',
      )
    },

    async 'deleting a template day keeps the session history'() {
      // sessions.program_day_id is ON DELETE SET NULL, so history survives.
      const { sessionId } = await startSession('2026-09-10', 'wednesday')
      must(
        await user.client
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', sessionId),
      )
      // CHANGED by migration 20261012120000 (slot link is ON DELETE SET NULL).
      // Previously a logged day could not be deleted:
      //   assert.ok(error, 'deleting a logged day should be refused')
      // Now the delete succeeds and the session survives, unlinked.
      must(
        await user.client
          .from('program_days')
          .delete()
          .eq('id', seeded.dayIds.wednesday),
      )
      assert.equal(
        sqlValue(
          `select count(*) from public.sessions where id = '${sessionId}' and program_day_id is null`,
        ),
        '1',
      )
    },
  },
  {
    async setup() {
      user = await newUser('partB')
      seeded = await seedProgram(user, {
        days: {
          monday: {
            title: 'Back & Biceps',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
          tuesday: { title: 'Chest & Tri', exercises: ['Barbell Bench Press'] },
          wednesday: { title: 'Shoulders & Legs', exercises: ['Leg Press'] },
        },
      })
    },
  },
)
