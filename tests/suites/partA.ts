/**
 * Part A — the split (program) template: a user builds days and slots, with the
 * constraints the builder depends on.
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

export default suite(
  'partA',
  {
    'a program has seven day rows'() {
      assert.equal(
        sqlValue(
          `select count(*) from public.program_days where program_id = '${seeded.programId}'`,
        ),
        '7',
      )
    },

    async 'an invalid day_of_week is rejected'() {
      const { error } = await user.client
        .from('program_days')
        .insert({ program_id: seeded.programId, day_of_week: 'funday' })
      assert.ok(error)
    },

    async 'rest_seconds is stored and nullable'() {
      const [first] = seeded.programExerciseIds.monday
      must(
        await user.client
          .from('program_exercises')
          .update({ rest_seconds: 90 })
          .eq('id', first),
      )
      assert.equal(
        sqlValue(
          `select rest_seconds from public.program_exercises where id = '${first}'`,
        ),
        '90',
      )
      must(
        await user.client
          .from('program_exercises')
          .update({ rest_seconds: null })
          .eq('id', first),
      )
      assert.equal(
        sqlValue(
          `select rest_seconds is null from public.program_exercises where id = '${first}'`,
        ),
        't',
      )
    },

    'the database default for rest_seconds stays null'() {
      // D10: "no timer" is a deliberate null. The 2-minute default is client-side.
      assert.equal(
        sqlValue(`select column_default from information_schema.columns
                  where table_name = 'program_exercises' and column_name = 'rest_seconds'`) ??
          '',
        '',
      )
    },

    async 'exercises keep their order'() {
      const rows = must(
        await user.client
          .from('program_exercises')
          .select('exercise_order, exercises(name)')
          .eq('program_day_id', seeded.dayIds.monday)
          .order('exercise_order'),
      ) as unknown as { exercises: { name: string } }[]
      assert.deepEqual(
        rows.map((r) => r.exercises.name),
        ['Lat Pulldown', 'Barbell Bicep Curl'],
      )
    },

    async 'deleting a day cascades to its slots'() {
      const dayId = seeded.dayIds.sunday
      must(
        await user.client
          .from('program_exercises')
          .select('id')
          .eq('program_day_id', dayId),
      )
      must(await user.client.from('program_days').delete().eq('id', dayId))
      assert.equal(
        sqlValue(
          `select count(*) from public.program_exercises where program_day_id = '${dayId}'`,
        ),
        '0',
      )
    },
  },
  {
    async setup() {
      user = await newUser('partA')
      seeded = await seedProgram(user, {
        days: {
          monday: {
            title: 'Back & Biceps',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
          sunday: { exercises: ['Leg Press'] },
        },
      })
    },
  },
)
