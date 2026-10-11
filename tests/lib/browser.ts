/**
 * Real-browser helpers for the UI suites: a phone-sized Chromium context
 * (414×896, the viewport the release checklist names) signed in as a local
 * test user.
 *
 * The app under test is whatever APP_URL points at, which must itself be
 * configured against the local Supabase stack.
 */
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

import { TEST_PASSWORD, type TestUser } from './local'

export const APP_URL = process.env.APP_URL ?? 'http://localhost:3100'

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser
  try {
    const res = await fetch(`${APP_URL}/sign-in`)
    if (!res.ok) throw new Error(String(res.status))
  } catch (e) {
    throw new Error(`App not reachable at ${APP_URL} (${String(e)})`)
  }
  browser = await chromium.launch()
  return browser
}

export async function closeBrowser() {
  await browser?.close()
  browser = null
}

export async function phoneContext(
  opts: { timeZone?: string; tzCookie?: boolean } = {},
): Promise<BrowserContext> {
  const timeZone = opts.timeZone ?? 'Asia/Kolkata'
  const context = await (
    await getBrowser()
  ).newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: timeZone,
  })
  if (opts.tzCookie ?? true) {
    await context.addCookies([
      { name: 'ajfit-tz', value: encodeURIComponent(timeZone), url: APP_URL },
    ])
  }
  return context
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto(`${APP_URL}/sign-in`)
  await page.fill('input[name=email]', user.email)
  await page.fill('input[name=password]', TEST_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(`${APP_URL}/`)
}

/** Types reps, then weight, on the in-app keypad. */
export async function keypad(page: Page, reps: string, weight: string) {
  for (const k of reps) {
    await page.getByRole('button', { name: k, exact: true }).click()
  }
  await page.getByRole('button', { name: /^Weight/ }).click()
  for (const k of weight) {
    await page.getByRole('button', { name: k, exact: true }).click()
  }
}

/** Starts today's default workout from /start and waits for the runner. */
export async function startTodaysWorkout(page: Page) {
  await page.goto(`${APP_URL}/start`)
  await page.getByRole('button', { name: 'Start Workout' }).click()
  await page.getByRole('button', { name: 'Confirm Start' }).click()
  await page.getByText('Logging Session').first().waitFor()
}
