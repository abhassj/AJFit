/**
 * Screenshots of Batch C's screens at 414×896 for a visual check.
 *
 *   APP_URL=http://localhost:3100 OUT=<dir> npx tsx tests/perf/screens-c.ts
 */
import path from 'node:path'

import { APP_URL, closeBrowser, phoneContext, signIn } from '../lib/browser'
import { deleteTestUsers, newUser, seedProgram, sql } from '../lib/local'

const OUT = process.env.OUT ?? '.'

async function main() {
  const user = await newUser('screensc')
  await seedProgram(user, {
    days: { monday: { title: 'Pull', exercises: ['Lat Pulldown'] } },
  })
  sql(`insert into public.profiles (id, height_cm, weight_unit) values ('${user.id}', 180, 'lbs');
       insert into public.weight_logs (user_id, log_date, weight) values ('${user.id}', '2026-09-01', 81);`)

  const ctx = await phoneContext({ onboardingPrompt: true })
  const page = await ctx.newPage()
  const shot = (name: string) =>
    page.screenshot({ path: path.join(OUT, `${name}.png`) })
  try {
    await signIn(page, user)
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(500)
    await shot('c1-onboarding-prompt')
    await page.getByRole('button', { name: 'Later' }).click()
    await page.goto(`${APP_URL}/profile`)
    await page.evaluate('window.scrollTo(0, 420)')
    await page.waitForTimeout(400)
    await shot('c2-profile-units')
    await page.getByRole('button', { name: /BMI/ }).click()
    await page.waitForTimeout(3000)
    await shot('c3-bmi')
  } finally {
    await ctx.close()
    await closeBrowser()
    deleteTestUsers()
  }
}

main()
