/**
 * The shared exercise catalog is readable by signed-in users, writable by no
 * one through the API, and invisible to anon.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { anonClient, newUser, sqlValue, type TestUser } from '../lib/local'

const CATALOG = ['categories', 'subcategories', 'exercises'] as const

let user: TestUser

export default suite(
  'catalog-rls',
  {
    async 'anon reads nothing from the catalog'() {
      const anon = anonClient()
      for (const table of CATALOG) {
        const { data, error } = await anon.from(table).select('id').limit(1)
        // Privileges were revoked from anon, so this is an error, not [].
        assert.ok(error || (data ?? []).length === 0, `${table} leaked to anon`)
      }
    },

    async 'authenticated users can read every catalog table'() {
      for (const table of CATALOG) {
        const { data, error } = await user.client.from(table).select('id')
        assert.equal(error, null, `${table}: ${error?.message}`)
        assert.ok((data ?? []).length > 0, `${table} is empty`)
      }
    },

    async 'authenticated insert into the catalog is refused'() {
      const sub = sqlValue('select id from public.subcategories limit 1')
      const { error } = await user.client
        .from('exercises')
        .insert({ subcategory_id: sub, name: 'Injected Exercise' })
      assert.ok(error, 'insert into exercises should fail')
      assert.equal(
        sqlValue(
          "select count(*) from public.exercises where name = 'Injected Exercise'",
        ),
        '0',
      )
    },

    async 'authenticated update and delete on the catalog change nothing'() {
      const before = sqlValue(
        "select name from public.categories where name = 'Chest'",
      )
      await user.client
        .from('categories')
        .update({ name: 'Hacked' })
        .eq('name', 'Chest')
      await user.client.from('categories').delete().eq('name', 'Chest')
      assert.equal(
        sqlValue("select name from public.categories where name = 'Chest'"),
        before,
      )
    },

    'anon holds no table privileges in public'() {
      assert.equal(
        sqlValue(`select count(*) from information_schema.role_table_grants
                  where grantee = 'anon' and table_schema = 'public'`),
        '0',
      )
    },

    'authenticated has no TRUNCATE anywhere in public'() {
      assert.equal(
        sqlValue(`select count(*) from information_schema.role_table_grants
                  where grantee = 'authenticated' and table_schema = 'public'
                    and privilege_type = 'TRUNCATE'`),
        '0',
      )
    },
  },
  {
    async setup() {
      user = await newUser('catalogrls')
    },
  },
)
