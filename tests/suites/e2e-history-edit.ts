/**
 * Editing a past day still saves and re-renders after the live logger stopped
 * revalidating (V2 Phase 1). The editor renders from the server, so each edit
 * must refresh its own page.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import { must, newUser, seedProgram, sql } from '../lib/local'
import { addDays, dateKey, parseDateKey } from '@/lib/home-types'
import { zonedDateKey } from '@/lib/timezone'
import { toKg, type WeightUnit } from '@/lib/units'

async function press(page: Page, keys: string) {
  for (const k of keys) {
    await page.getByRole('button', { name: k, exact: true }).click()
  }
}

/**
 * Batch D follow-up to the "PR 17 kg" report: the history editor, reached the
 * way a user gets there (Home → day → Edit), must store reps as reps and
 * weight as weight — a reps-only set as weight NULL, and lbs converted to kg.
 */
async function editorStoresColumnsRight(unit: WeightUnit) {
  const user = await newUser(`histcols${unit}`)
  sql(`insert into public.profiles (id, weight_unit) values ('${user.id}', '${unit}')
       on conflict (id) do update set weight_unit = excluded.weight_unit`)
  const seeded = await seedProgram(user, {
    days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
  })
  const today = zonedDateKey('Asia/Kolkata')
  const date = dateKey(addDays(parseDateKey(today), -8))
  const s = must(
    await user.client
      .from('sessions')
      .insert({
        user_id: user.id,
        program_day_id: seeded.dayIds.monday,
        session_date: date,
        status: 'completed',
      })
      .select('id')
      .single(),
  )
  must(
    await user.client.from('session_exercises').insert({
      session_id: s.id,
      program_exercise_id: seeded.programExerciseIds.monday[0],
      status: 'completed',
    }),
  )
  const rows = () =>
    sql(`select st.set_number, st.reps_done, coalesce(st.weight::text, 'NULL')
      from public.sets st
      join public.session_exercises se on se.id = st.session_exercise_id
      where se.session_id = '${s.id}' order by st.set_number`)
  const ctx = await phoneContext()
  const page = await ctx.newPage()
  /*
   * Each step waits for the DB, then for the screen — with no reload, so
   * this is also the regression test for the editor's re-render after a save
   * (without the client refresh in DayLogger.run it failed on about half of
   * runs, on the live build too).
   */
  const settle = async (count: number, text: string) => {
    const end = Date.now() + 10_000
    while (rows().length !== count && Date.now() < end) {
      await page.waitForTimeout(150)
    }
    await page.getByText(text).waitFor()
  }
  try {
    await signIn(page, user)
    await page.goto(`${APP_URL}/`)
    if (date.slice(0, 7) !== today.slice(0, 7)) {
      await page.getByRole('button', { name: 'Previous month' }).click()
    }
    await page.locator(`a[href="/history/${date}"]`).click()
    await page.getByRole('link', { name: 'Edit logged workout' }).click()
    await page.getByRole('button', { name: 'Add Set' }).waitFor()

    // 1. Reps only: 17, weight left blank.
    await press(page, '17')
    await page.getByRole('button', { name: 'Add Set' }).click()
    await settle(1, '17 × —')
    // 2. Reps and weight, typed in the user's unit.
    await press(page, '10')
    await page.getByRole('button', { name: /^Weight/ }).click()
    await press(page, '100')
    await page.getByRole('button', { name: 'Add Set' }).click()
    await settle(2, `10 × 100 ${unit}`)
    // 3. Correct set 1's reps through Edit → Update Set.
    await page.getByRole('button', { name: 'Edit set 1' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await press(page, '12')
    await page.getByRole('button', { name: 'Update Set' }).click()
    const end = Date.now() + 10_000
    while (rows()[0]?.[1] !== '12' && Date.now() < end) {
      await page.waitForTimeout(150)
    }
    await page.getByText('12 × —').waitFor()

    const got = rows()
    assert.deepEqual(
      got.map(([n, r, w]) => [n, r, w === 'NULL' ? w : Number(w)]),
      [
        ['1', '12', 'NULL'],
        ['2', '10', toKg(100, unit)],
      ],
      JSON.stringify(got),
    )
    // And the PR it produces is the weighted set — no reps value as a weight.
    const prs = must(
      await user.client.rpc('exercise_prs', {
        p_names: ['Lat Pulldown'],
        p_include_reps: true,
      }),
    ) as { weight_kg: number; reps: number; pr_kind: string }[]
    assert.deepEqual(
      prs.map((p) => [p.pr_kind, Number(p.weight_kg), p.reps]),
      [['weight', toKg(100, unit), 10]],
    )
  } finally {
    await ctx.close()
  }
}

export default suite(
  'e2e-history-edit',
  {
    async 'adding a set to a logged day saves it and shows it'() {
      const user = await newUser('histedit')
      const seeded = await seedProgram(user, {
        days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
      })
      const s = must(
        await user.client
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: seeded.dayIds.monday,
            session_date: '2026-09-07',
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      must(
        await user.client.from('session_exercises').insert({
          session_id: s.id,
          program_exercise_id: seeded.programExerciseIds.monday[0],
          status: 'completed',
        }),
      )

      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        // CHANGED in V2 Phase 3: a logged day opens read-only first, and the
        // editor is behind "Edit logged workout". Previously the keypad was on
        // /history/<date> directly:
        //   await page.goto(`${APP_URL}/history/2026-09-07`)  // then type
        await page.goto(`${APP_URL}/history/2026-09-07`)
        await page.getByRole('link', { name: 'Edit logged workout' }).click()
        await page.getByRole('button', { name: 'Add Set' }).waitFor()
        for (const k of '11') {
          await page.getByRole('button', { name: k, exact: true }).click()
        }
        await page.getByRole('button', { name: /^Weight/ }).click()
        for (const k of '55') {
          await page.getByRole('button', { name: k, exact: true }).click()
        }
        await page.getByRole('button', { name: 'Add Set' }).click()
        await page.getByText('11 × 55 kg').waitFor()

        assert.deepEqual(
          sql(`select st.set_number, st.reps_done, st.weight from public.sets st
            join public.session_exercises se on se.id = st.session_exercise_id
            where se.session_id = '${s.id}'`),
          [['1', '11', '55']],
        )
      } finally {
        await ctx.close()
      }
    },

    async 'every save shows up without a reload'() {
      // The editor's list must re-render after each save. Before the client
      // refresh in DayLogger.run, the server action's refresh() was
      // intermittently not committed right after arriving from Home → day →
      // Edit (about half of runs on the live build): the set was saved but
      // stayed invisible until a reload. Six round trips make a miss all but
      // certain without the fix.
      const user = await newUser('histfresh')
      const seeded = await seedProgram(user, {
        days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
      })
      const today = zonedDateKey('Asia/Kolkata')
      const date = dateKey(addDays(parseDateKey(today), -8))
      const s = must(
        await user.client
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: seeded.dayIds.monday,
            session_date: date,
            status: 'completed',
          })
          .select('id')
          .single(),
      )
      must(
        await user.client.from('session_exercises').insert({
          session_id: s.id,
          program_exercise_id: seeded.programExerciseIds.monday[0],
          status: 'completed',
        }),
      )
      const ctx = await phoneContext()
      const page = await ctx.newPage()
      try {
        await signIn(page, user)
        for (let n = 1; n <= 6; n++) {
          await page.goto(`${APP_URL}/`)
          if (date.slice(0, 7) !== today.slice(0, 7)) {
            await page.getByRole('button', { name: 'Previous month' }).click()
          }
          await page.locator(`a[href="/history/${date}"]`).click()
          await page.getByRole('link', { name: 'Edit logged workout' }).click()
          await page.getByRole('button', { name: 'Add Set' }).waitFor()
          await press(page, String(n))
          await page.getByRole('button', { name: 'Add Set' }).click()
          await page
            .getByText(`${n} × —`, { exact: true })
            .waitFor({ timeout: 5000 })
            .catch(() => {
              throw new Error(`set ${n} saved but not shown without a reload`)
            })
        }
      } finally {
        await ctx.close()
      }
    },

    async 'Home → day → Edit stores reps and weight in the right columns (kg)'() {
      await editorStoresColumnsRight('kg')
    },

    async 'Home → day → Edit stores reps and weight in the right columns (lbs)'() {
      await editorStoresColumnsRight('lbs')
    },
  },
  { teardown: closeBrowser },
)
