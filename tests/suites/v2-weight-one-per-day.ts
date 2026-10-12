/**
 * Migration 20261013120000 — one bodyweight entry per user per day.
 *
 *   - Duplicate same-day rows are moved (not deleted) to weight_logs_archive,
 *     keeping the row the app showed; re-running changes nothing.
 *   - The archive is invisible to anon and authenticated.
 *   - The build live before this change inserts with a plain .insert(); those
 *     exact calls still succeed and replace the day's row, through RLS.
 *   - Nobody can replace or remove another user's entry.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { suite } from '../lib/harness'
import {
  anonClient,
  must,
  newUser,
  sql,
  sqlValue,
  type TestUser,
} from '../lib/local'

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20261013120000_weight_logs_one_per_day.sql',
)

let a: TestUser
let b: TestUser

function rows(userId: string, date: string) {
  return sql(`select weight::text from public.weight_logs
    where user_id = '${userId}' and log_date = '${date}' order by weight`)
}

/** Runs the migration file exactly as the deploy does. */
function runMigration() {
  sql(readFileSync(MIGRATION, 'utf8'))
}

export default suite(
  'v2-weight-one-per-day',
  {
    async 'the live build’s plain insert replaces the day’s entry'() {
      // bbf0ee2 (live before this change), src/app/(app)/actions.ts:
      //   supabase.from('weight_logs').insert({ user_id, log_date, weight })
      for (const weight of [70, 71.5, 72]) {
        must(
          await a.client
            .from('weight_logs')
            .insert({ user_id: a.id, log_date: '2026-10-01', weight }),
        )
      }
      assert.deepEqual(rows(a.id, '2026-10-01'), [['72']])
    },

    async 'an insert that selects the row back still gets it'() {
      // The shape that would break with an "update and return NULL" trigger.
      const row = must(
        await a.client
          .from('weight_logs')
          .insert({ user_id: a.id, log_date: '2026-10-01', weight: 73 })
          .select('weight, log_date')
          .single(),
      )
      assert.deepEqual(row, { weight: 73, log_date: '2026-10-01' })
      assert.deepEqual(rows(a.id, '2026-10-01'), [['73']])
    },

    async 'the app’s upsert on (user_id, log_date) replaces too'() {
      must(
        await a.client
          .from('weight_logs')
          .upsert(
            { user_id: a.id, log_date: '2026-10-01', weight: 74 },
            { onConflict: 'user_id,log_date' },
          ),
      )
      assert.deepEqual(rows(a.id, '2026-10-01'), [['74']])
    },

    'the trigger’s delete runs under the caller’s own RLS policy'() {
      // The replace works as `authenticated` (tests above) because the one
      // policy on weight_logs covers DELETE for the caller's own rows, and the
      // role holds the DELETE privilege.
      assert.equal(
        sqlValue(`select cmd || ':' || roles::text from pg_policies
          where tablename = 'weight_logs'`),
        'ALL:{authenticated}',
      )
      assert.equal(
        sqlValue(`select count(*) from information_schema.role_table_grants
          where table_name = 'weight_logs' and grantee = 'authenticated'
            and privilege_type = 'DELETE'`),
        '1',
      )
      assert.equal(
        sqlValue(
          `select prosecdef from pg_proc where proname = 'weight_logs_replace_same_day'`,
        ),
        'f',
        'trigger must run as the caller (SECURITY INVOKER)',
      )
    },

    async 'another user’s entry on the same date is never touched'() {
      must(
        await b.client
          .from('weight_logs')
          .insert({ user_id: b.id, log_date: '2026-10-01', weight: 90 }),
      )
      assert.deepEqual(rows(a.id, '2026-10-01'), [['74']])

      // Claiming A's user_id: the trigger's delete sees none of A's rows, and
      // the insert itself is refused.
      const { error } = await b.client
        .from('weight_logs')
        .insert({ user_id: a.id, log_date: '2026-10-01', weight: 1 })
      assert.ok(error, 'insert as another user was accepted')
      assert.deepEqual(rows(a.id, '2026-10-01'), [['74']])
      assert.deepEqual(rows(b.id, '2026-10-01'), [['90']])
    },

    async 'the archive is unreadable and unwritable for anon and authenticated'() {
      for (const client of [a.client, anonClient()]) {
        const read = await client
          .from('weight_logs_archive')
          .select('*')
          .limit(1)
        assert.ok(read.error, 'archive was readable')
        const write = await client.from('weight_logs_archive').insert({
          id: '00000000-0000-4000-8000-0000000000aa',
          user_id: a.id,
          log_date: '2026-10-01',
          weight: 1,
        })
        assert.ok(write.error, 'archive was writable')
      }
      assert.equal(
        sqlValue(`select string_agg(distinct grantee, ',') from information_schema.role_table_grants
          where table_name = 'weight_logs_archive'`),
        'postgres',
      )
      assert.equal(
        sqlValue(`select relrowsecurity::text || ',' || (select count(*) from pg_policies
            where tablename = 'weight_logs_archive')
          from pg_class where relname = 'weight_logs_archive'`),
        'true,0',
      )
    },

    'migrating archives duplicates, keeps the row the app showed, and is re-runnable'() {
      // Recreate the pre-migration state for one user: no constraint, no
      // trigger, three rows on one date (the app showed the highest id).
      sql(`alter table public.weight_logs drop constraint weight_logs_user_id_log_date_key;
           drop trigger weight_logs_replace_same_day on public.weight_logs;
           delete from public.weight_logs where user_id = '${a.id}';
           insert into public.weight_logs (id, user_id, log_date, weight) values
             ('11111111-1111-4111-8111-111111111111', '${a.id}', '2026-09-20', 70),
             ('ffffffff-ffff-4fff-8fff-ffffffffffff', '${a.id}', '2026-09-20', 75),
             ('88888888-8888-4888-8888-888888888888', '${a.id}', '2026-09-20', 72),
             ('22222222-2222-4222-8222-222222222222', '${a.id}', '2026-09-21', 76);`)
      const shownBefore = sqlValue(`select weight::text from public.weight_logs
        where user_id = '${a.id}' order by log_date desc, id desc offset 1 limit 1`)
      assert.equal(shownBefore, '75')

      runMigration()
      assert.deepEqual(rows(a.id, '2026-09-20'), [['75']])
      assert.deepEqual(rows(a.id, '2026-09-21'), [['76']])
      assert.deepEqual(
        sql(`select weight::text, (archived_at is not null)::text from public.weight_logs_archive
          where user_id = '${a.id}' order by weight`),
        [
          ['70', 'true'],
          ['72', 'true'],
        ],
      )

      // Re-run: no error, nothing moves, constraint and trigger still there.
      runMigration()
      assert.equal(
        sqlValue(
          `select count(*) from public.weight_logs_archive where user_id = '${a.id}'`,
        ),
        '2',
      )
      assert.equal(
        sqlValue(
          `select count(*) from public.weight_logs where user_id = '${a.id}'`,
        ),
        '2',
      )
      assert.equal(
        sqlValue(`select count(*) from pg_constraint
          where conname = 'weight_logs_user_id_log_date_key'`),
        '1',
      )
      assert.equal(
        sqlValue(`select count(*) from pg_trigger
          where tgname = 'weight_logs_replace_same_day'`),
        '1',
      )
    },
  },
  {
    async setup() {
      a = await newUser('wlA')
      b = await newUser('wlB')
    },
  },
)
