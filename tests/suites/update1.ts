/**
 * Update 1 — profile fields (display name, motto, avatar), bodyweight logs and
 * the avatars bucket.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { must, newUser, sqlValue, type TestUser } from '../lib/local'

let user: TestUser

export default suite(
  'update1',
  {
    async 'a profile row can be created by upsert and read back'() {
      must(
        await user.client.from('profiles').upsert({
          id: user.id,
          display_name: 'Tester',
          motto: 'Lift',
          goal_bodyweight: 75,
        }),
      )
      const row = must(
        await user.client
          .from('profiles')
          .select('display_name, motto, goal_bodyweight')
          .eq('id', user.id)
          .single(),
      )
      assert.deepEqual(row, {
        display_name: 'Tester',
        motto: 'Lift',
        goal_bodyweight: 75,
      })
    },

    async 'a user cannot create a profile for someone else'() {
      const { error } = await user.client
        .from('profiles')
        .insert({ id: '00000000-0000-0000-0000-000000000001' })
      assert.ok(error)
    },

    async 'bodyweight logs are stored per date'() {
      must(
        await user.client.from('weight_logs').insert([
          { user_id: user.id, log_date: '2026-10-01', weight: 70.5 },
          { user_id: user.id, log_date: '2026-10-08', weight: 71 },
        ]),
      )
      const latest = must(
        await user.client
          .from('weight_logs')
          .select('weight')
          .order('log_date', { ascending: false })
          .limit(1)
          .single(),
      )
      assert.equal(latest.weight, 71)
    },

    'the avatars bucket is public with a 5MB image-only limit'() {
      assert.equal(
        sqlValue(
          `select public || ',' || file_size_limit from storage.buckets where id = 'avatars'`,
        ),
        'true,5242880',
      )
    },
  },
  {
    async setup() {
      user = await newUser('update1')
    },
  },
)
