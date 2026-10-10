/**
 * Screenshots of the Start flow at 414×896 for a visual check.
 *
 *   APP_URL=http://localhost:3100 OUT=<dir> npx tsx tests/perf/screens.ts
 */
import path from 'node:path'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { deleteTestUsers, newUser, seedProgram, sql } from '../lib/local'

const OUT = process.env.OUT ?? '.'

async function main() {
  const user = await newUser('screens')
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]
  await seedProgram(user, {
    days: Object.fromEntries(
      days.map((d) => [
        d,
        {
          title: 'Back & Biceps',
          exercises: ['Lat Pulldown', 'Barbell Bicep Curl'],
        },
      ]),
    ),
  })
  sql(
    `insert into public.profiles (id, weight_unit) values ('${user.id}', 'lbs')`,
  )
  const ctx = await phoneContext()
  const page = await ctx.newPage()
  const shot = (name: string) =>
    page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
  try {
    await signIn(page, user)
    await page.goto(`${APP_URL}/start`)
    await page.waitForTimeout(800)
    await shot('1-start')
    await page.getByRole('button', { name: 'Start Workout' }).click()
    await page.getByRole('button', { name: 'Confirm Start' }).click()
    await page.getByText('Logging Session').first().waitFor()
    for (const k of '10')
      await page.getByRole('button', { name: k, exact: true }).click()
    await page.getByRole('button', { name: /^Weight/ }).click()
    for (const k of '135')
      await page.getByRole('button', { name: k, exact: true }).click()
    await page.route('**/start', (r) =>
      r.request().headers()['next-action'] ? r.abort() : r.continue(),
    )
    await page.getByRole('button', { name: 'Log Set' }).click()
    await page.getByRole('alert').first().waitFor()
    await page.waitForTimeout(400)
    await shot('2-runner-failed-save')
    await page.unroute('**/start')
    await page.getByRole('button', { name: 'Retry' }).click()
    await page.waitForTimeout(800)
    await shot('3-runner-saved')
  } finally {
    await ctx.close()
    await closeBrowser()
    deleteTestUsers()
  }
}

main()
