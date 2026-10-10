/**
 * Access to the LOCAL Supabase stack only.
 *
 * Every suite runs against `supabase start` on this machine, never the live
 * project: signups here need no email confirmation (supabase/config.toml has
 * enable_confirmations = false), and nothing a test does can touch a friend's
 * data. The URL guard below makes pointing this at a remote host a hard error
 * rather than a convention.
 *
 * Only the publishable anon key is used for API calls, exactly as the app does,
 * so every assertion goes through RLS. Database-level verification goes through
 * psql inside the local db container as the postgres superuser, which is how
 * the tests look *underneath* RLS to confirm what was actually stored.
 */

import { execFileSync, execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DB_CONTAINER = process.env.AJFIT_TEST_DB_CONTAINER ?? 'supabase_db_AJFit'

type LocalEnv = { url: string; anonKey: string }

let cached: LocalEnv | null = null

export function localEnv(): LocalEnv {
  if (cached) return cached
  const raw = execSync('npx supabase status -o json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const status = JSON.parse(raw.slice(raw.indexOf('{')))
  const url: string = status.API_URL
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to run tests against non-local Supabase: ${url}`)
  }
  cached = { url, anonKey: status.ANON_KEY }
  return cached
}

/** A client with no session: the `anon` role. */
export function anonClient(): SupabaseClient {
  const { url, anonKey } = localEnv()
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Runs SQL as postgres in the local db container. Rows as arrays of strings. */
export function sql(query: string): string[][] {
  const out = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-F',
      '\t',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  )
  return out
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'))
}

/** First column of the first row. */
export function sqlValue(query: string): string | undefined {
  return sql(query)[0]?.[0]
}

export const TEST_EMAIL_DOMAIN = 'ajfit.test'
export const TEST_PASSWORD = 'local-test-password-123'

export type TestUser = {
  id: string
  email: string
  client: SupabaseClient
}

/** Signs up a throwaway user on the local stack and returns a client for it. */
export async function newUser(tag: string): Promise<TestUser> {
  const email = `test.${tag}.${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`
  const client = anonClient()
  const { data, error } = await client.auth.signUp({
    email,
    password: TEST_PASSWORD,
  })
  if (error || !data.user || !data.session) {
    throw new Error(
      `signUp failed for ${email}: ${error?.message ?? 'no session (are confirmations enabled locally?)'}`,
    )
  }
  return { id: data.user.id, email, client }
}

/** Removes every account the suites created. Local only. */
export function deleteTestUsers() {
  sql(`delete from auth.users where email like 'test.%@${TEST_EMAIL_DOMAIN}';`)
}

/** Throws with the PostgREST message if a call failed. */
export function must<T>(result: {
  data: T
  error: { message: string } | null
}): NonNullable<T> {
  if (result.error) throw new Error(result.error.message)
  // Writes without .select() resolve to null data; callers that need rows
  // always select them.
  return result.data as NonNullable<T>
}

/**
 * Builds a one-day program for `user` with the given catalog exercises and
 * returns the ids the session tests need.
 */
export async function seedProgram(
  user: TestUser,
  opts: {
    days?: Partial<
      Record<
        string,
        { title?: string | null; rest?: boolean; exercises?: string[] }
      >
    >
  } = {},
) {
  const { client } = user
  const program = must(
    await client
      .from('programs')
      .insert({ user_id: user.id, name: 'Test Split' })
      .select('id')
      .single(),
  )
  const allDays = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  const dayIds: Record<string, string> = {}
  const programExerciseIds: Record<string, string[]> = {}

  for (const dow of allDays) {
    const spec = opts.days?.[dow] ?? {}
    const day = must(
      await client
        .from('program_days')
        .insert({
          program_id: program.id,
          day_of_week: dow,
          title: spec.title ?? null,
          is_rest_day: spec.rest ?? false,
        })
        .select('id')
        .single(),
    )
    dayIds[dow] = day.id
    programExerciseIds[dow] = []

    for (const [i, name] of (spec.exercises ?? []).entries()) {
      const exercise = must(
        await client
          .from('exercises')
          .select('id')
          .eq('name', name)
          .limit(1)
          .single(),
      )
      const pe = must(
        await client
          .from('program_exercises')
          .insert({
            program_day_id: day.id,
            exercise_id: exercise.id,
            exercise_order: i + 1,
            prescribed_reps: '3x10',
          })
          .select('id')
          .single(),
      )
      programExerciseIds[dow].push(pe.id)
    }
  }

  return { programId: program.id, dayIds, programExerciseIds }
}
