/**
 * Pre-push audit, item 1 and the action-level half of item 2.
 *
 * Every Server Action is a public POST endpoint, and since V2 the proxy no
 * longer authenticates Server Action requests (each action does). So this
 * suite proves, for every action the build exposes:
 *
 *   - a call with no cookies is redirected to /sign-in and writes nothing;
 *   - a call signed in as user B, aimed at user A's rows, changes nothing of
 *     user A's;
 *   - the list of actions is complete: a new action that is not classified
 *     here fails the suite until someone decides how it is guarded.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import type { BrowserContext } from '@playwright/test'

import {
  callAnonymous,
  callAs,
  manifestActions,
  resultOf,
  type ManifestAction,
} from '../lib/actions'
import { closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import {
  dbFingerprint,
  must,
  newUser,
  seedProgram,
  sqlValue,
  type TestUser,
} from '../lib/local'

/** Reachable without a session by design. */
const PUBLIC = ['signIn', 'signOut', 'signUp']

/**
 * Exported from a 'use server' file but imported by no client module.
 * Was ['copyDay'] until that dead export was deleted in V2 Batch B.
 */
const NOT_EXPOSED: string[] = []

let a: TestUser
let b: TestUser
let ids: {
  mondayDay: string
  slot0: string
  doneSession: string
  doneSe: string
  doneSet: string
  liveSession: string
  liveSe: string
}
let actions: ManifestAction[]
let bContext: BrowserContext | null = null

/** Arguments aimed at user A's rows, per action. */
function argsFor(name: string): unknown[] {
  const fresh = randomUUID()
  const table: Record<string, unknown[]> = {
    // start
    startSession: [ids.mondayDay],
    skipDay: [],
    logSet: [fresh, ids.liveSe, 9, 5, 50],
    updateSet: [ids.doneSet, 1, 1],
    setExerciseStatus: [ids.liveSe, 'skipped'],
    saveComment: [ids.liveSe, 'pwned'],
    addPausedSeconds: [ids.liveSession, 999],
    finishSession: [ids.liveSession, 0],
    // history
    startBackfill: ['2026-09-01', 'monday'],
    deleteSet: [ids.doneSet, '2026-09-07'],
    deleteSession: [ids.doneSession, '2026-09-07'],
    editLogSet: [fresh, ids.doneSe, 9, 5, 50],
    editUpdateSet: [ids.doneSet, 1, 1],
    editExerciseStatus: [ids.doneSe, 'skipped'],
    editComment: [ids.doneSe, 'pwned'],
    // home / profile / split
    loadMonth: [2026, 8],
    logBodyweight: [70],
    saveGoalBodyweight: [75],
    saveProfileDetails: [{ display_name: 'pwned', motto: 'pwned' }],
    saveAvatarUrl: ['https://example.com/x.png'],
    saveProgram: ['Pwned', []],
  }
  if (!(name in table)) throw new Error(`Unclassified Server Action: ${name}`)
  return table[name]
}

/** Every export of every 'use server' file under src/app. */
function sourceActions(): string[] {
  const names: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry)) {
        const src = readFileSync(full, 'utf8')
        if (!src.startsWith("'use server'")) continue
        for (const m of src.matchAll(/^export async function (\w+)/gm)) {
          names.push(m[1])
        }
      }
    }
  }
  walk(path.resolve(__dirname, '../../src/app'))
  return names.sort()
}

export default suite(
  'e2e-actions-auth',
  {
    'every exported action is exposed, or listed as not exposed'() {
      const exposed = new Set(actions.map((x) => x.name))
      const missing = sourceActions().filter(
        (n) => !exposed.has(n) && !NOT_EXPOSED.includes(n),
      )
      assert.deepEqual(missing, [])
      for (const n of NOT_EXPOSED)
        assert.ok(!exposed.has(n), `${n} is exposed now`)
    },

    'every exposed action is classified (public, or with attack arguments)'() {
      for (const x of actions) {
        if (PUBLIC.includes(x.name)) continue
        argsFor(x.name) // throws for an unclassified action
      }
      assert.deepEqual(
        actions
          .filter((x) => PUBLIC.includes(x.name))
          .map((x) => x.name)
          .sort(),
        PUBLIC,
      )
    },

    async 'every protected action redirects a signed-out call to /sign-in'() {
      const before = dbFingerprint()
      const failures: string[] = []
      for (const x of actions) {
        if (PUBLIC.includes(x.name)) continue
        const res = await callAnonymous(x, argsFor(x.name))
        if (!res.redirect?.startsWith('/sign-in')) {
          failures.push(
            `${x.name}: status ${res.status}, redirect ${res.redirect}, ${resultOf(res.body).error ?? ''}`,
          )
        }
      }
      assert.deepEqual(failures, [])
      assert.equal(dbFingerprint(), before, 'a signed-out call changed the DB')
    },

    async 'an unknown or stale action id is refused with 404'() {
      const res = await callAnonymous(
        { id: '00deadbeef00deadbeef00deadbeef00deadbeef00', route: '/start' },
        [],
      )
      assert.equal(res.status, 404)
      assert.match(res.body, /Server action not found/)
    },

    async 'user B, signed in, changes nothing of user A’s through any action'() {
      const beforeA = dbFingerprint(a.id)
      const ctx = await phoneContext()
      bContext = ctx
      const page = await ctx.newPage()
      await signIn(page, b)

      const results: string[] = []
      for (const x of actions) {
        if (PUBLIC.includes(x.name)) continue
        const res = await callAs(ctx.request, x, argsFor(x.name))
        results.push(`${x.name}:${res.status}`)
        assert.ok(
          !res.redirect?.startsWith('/sign-in'),
          `${x.name}: B was not signed in`,
        )
      }

      assert.equal(
        dbFingerprint(a.id),
        beforeA,
        `A changed after: ${results.join(' ')}`,
      )
      // And B's own writes never point into A's data.
      assert.equal(
        sqlValue(`select count(*) from public.sessions
          where user_id = '${b.id}' and program_day_id = '${ids.mondayDay}'`),
        '0',
      )
    },
  },
  {
    async setup() {
      actions = manifestActions()
      a = await newUser('actA')
      b = await newUser('actB')
      const seeded = await seedProgram(a, {
        days: {
          monday: {
            title: 'Pull',
            exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
          },
        },
      })
      const [slot0] = seeded.programExerciseIds.monday
      const mk = async (date: string, status: string) =>
        must(
          await a.client
            .from('sessions')
            .insert({
              user_id: a.id,
              program_day_id: seeded.dayIds.monday,
              session_date: date,
              status,
              start_time: new Date().toISOString(),
            })
            .select('id')
            .single(),
        ).id as string
      const doneSession = await mk('2026-09-07', 'completed')
      const liveSession = await mk('2026-09-08', 'in_progress')
      const se = async (session: string) =>
        must(
          await a.client
            .from('session_exercises')
            .insert({ session_id: session, program_exercise_id: slot0 })
            .select('id')
            .single(),
        ).id as string
      const doneSe = await se(doneSession)
      const liveSe = await se(liveSession)
      const doneSet = must(
        await a.client
          .from('sets')
          .insert({
            session_exercise_id: doneSe,
            set_number: 1,
            reps_done: 8,
            weight: 60,
          })
          .select('id')
          .single(),
      ).id as string
      must(
        await a.client
          .from('profiles')
          .upsert({ id: a.id, display_name: 'A', motto: 'mine' }),
      )
      must(
        await a.client
          .from('weight_logs')
          .insert({ user_id: a.id, log_date: '2026-09-01', weight: 72 }),
      )
      ids = {
        mondayDay: seeded.dayIds.monday,
        slot0,
        doneSession,
        doneSe,
        doneSet,
        liveSession,
        liveSe,
      }
    },
    async teardown() {
      await bContext?.close()
      await closeBrowser()
    },
  },
)
