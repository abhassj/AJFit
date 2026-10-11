/**
 * Editing a past day still saves and re-renders after the live logger stopped
 * revalidating (V2 Phase 1). The editor renders from the server, so each edit
 * must refresh its own page.
 */
import assert from 'node:assert/strict'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { suite } from '../lib/harness'
import { must, newUser, seedProgram, sql } from '../lib/local'

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
  },
  { teardown: closeBrowser },
)
