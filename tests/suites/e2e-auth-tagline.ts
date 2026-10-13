/**
 * Batch D item 4 — the hazard-sign tagline above the sign-in and sign-up
 * forms: copy from BRAND.tagline, an icon (not an emoji), AA contrast, a
 * short entrance that never moves the form, and the submit button still
 * above the fold on small phones.
 */
import assert from 'node:assert/strict'

import type { Page } from '@playwright/test'

import { BRAND } from '@/lib/brand'

import { APP_URL, closeBrowser, getBrowser } from '../lib/browser'
import { suite } from '../lib/harness'

const ROUTES = ['sign-in', 'sign-up']
const TAGLINE = `section[aria-label^="${BRAND.tagline.label}"]`

async function phone(width = 414, height = 896) {
  return (await getBrowser()).newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
}

/** WCAG contrast of each text line against what is actually behind it. */
async function contrasts(page: Page) {
  return (await page.evaluate(`(() => {
    // Any CSS colour (Tailwind emits oklab for /opacity) to sRGB via a canvas.
    const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
    const rgba = (s) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const over = (top, under) => top.slice(0, 3).map((c, i) => c * top[3] + under[i] * (1 - top[3]))
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const bodyBg = rgba(getComputedStyle(document.body).backgroundColor)
    const page = bodyBg[3] === 1 ? bodyBg : rgba(getComputedStyle(document.documentElement).backgroundColor)
    const section = document.querySelector('${TAGLINE}')
    const panel = over(rgba(getComputedStyle(section).backgroundColor), page)
    const chip = section.querySelector('span:not([aria-hidden])')
    const chipBg = over(rgba(getComputedStyle(chip).backgroundColor), panel)
    const [headline, sub] = section.querySelectorAll('p')
    const text = (el, bg) => ratio(over(rgba(getComputedStyle(el).color), bg), bg)
    return { chip: text(chip, chipBg), headline: text(headline, panel), sub: text(sub, panel) }
  })()`)) as Record<string, number>
}

export default suite(
  'e2e-auth-tagline',
  {
    async 'both auth pages show the BRAND.tagline copy above the form, with an icon'() {
      const ctx = await phone()
      const page = await ctx.newPage()
      try {
        for (const route of ROUTES) {
          await page.goto(`${APP_URL}/${route}`)
          const tagline = page.locator(TAGLINE)
          await tagline.waitFor()
          const text = (await tagline.textContent()) ?? ''
          assert.ok(text.includes(BRAND.tagline.label), route)
          assert.ok(text.includes(BRAND.tagline.headline), route)
          assert.ok(text.includes(BRAND.tagline.sub), route)
          assert.ok(!/[⚠☢\u{1F6A7}]/u.test(text), `emoji in ${route}`)
          assert.equal(await tagline.locator('svg').count(), 1, 'hazard icon')
          // Rendered uppercase, amber, with the diagonal stripe edge.
          const chip = await page.evaluate(`(() => {
            const s = document.querySelector('${TAGLINE}')
            const c = getComputedStyle(s.querySelector('span:not([aria-hidden])'))
            const edge = getComputedStyle(s.querySelector('span[aria-hidden]'))
            return [c.textTransform, c.color, edge.backgroundImage.startsWith('repeating-linear-gradient')]
          })()`)
          assert.deepEqual(
            chip,
            ['uppercase', 'rgb(245, 184, 61)', true],
            JSON.stringify(chip),
          )
          // Above the form card.
          const [t, f] = await Promise.all([
            tagline.boundingBox(),
            page.locator('form').boundingBox(),
          ])
          assert.ok(t && f && t.y + t.height <= f.y, `${route} order`)
        }
      } finally {
        await ctx.close()
      }
    },

    async 'every line meets WCAG AA contrast'() {
      const ctx = await phone()
      const page = await ctx.newPage()
      try {
        for (const route of ROUTES) {
          await page.goto(`${APP_URL}/${route}`)
          await page.locator(TAGLINE).waitFor()
          await page.waitForTimeout(500)
          const c = await contrasts(page)
          for (const [line, ratio] of Object.entries(c)) {
            assert.ok(ratio >= 4.5, `${route} ${line} ${ratio.toFixed(2)}:1`)
          }
        }
      } finally {
        await ctx.close()
      }
    },

    async 'the entrance is short and never moves the form'() {
      const ctx = await phone()
      // From the first frame: when the fade starts and ends, and the layout
      // position (offsetTop ignores transforms) of the submit button.
      await ctx.addInitScript(`(() => {
        const log = { start: null, end: null, tops: new Set() }
        window.__tagline = log
        const tick = (now) => {
          const s = document.querySelector('${TAGLINE}')
          const btn = document.querySelector('button[type="submit"]')
          if (s && btn) {
            let top = 0
            for (let el = btn; el; el = el.offsetParent) top += el.offsetTop
            log.tops.add(top)
            const o = Number(getComputedStyle(s).opacity)
            if (o > 0 && o < 1 && log.start === null) log.start = now
            if (o === 1 && log.start !== null && log.end === null) log.end = now
          }
          if (log.end === null) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })()`)
      const page = await ctx.newPage()
      try {
        await page.goto(`${APP_URL}/sign-in`)
        await page.waitForFunction('window.__tagline.end !== null')
        await page.waitForTimeout(400)
        const log = (await page.evaluate(
          `({ ms: window.__tagline.end - window.__tagline.start, tops: [...window.__tagline.tops] })`,
        )) as { ms: number; tops: number[] }
        assert.ok(log.ms <= 400 + 34, `entrance took ${Math.round(log.ms)}ms`)
        assert.equal(log.tops.length, 1, `form moved: ${log.tops.join(', ')}`)
        assert.equal(
          await page.evaluate(
            `getComputedStyle(document.querySelector('${TAGLINE}')).transform`,
          ),
          'none',
        )
      } finally {
        await ctx.close()
      }
    },

    async 'reduced motion shows it at once'() {
      const ctx = await phone()
      const page = await ctx.newPage()
      try {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(`${APP_URL}/sign-up`)
        await page.locator(TAGLINE).waitFor()
        await page.waitForLoadState('networkidle')
        const style = await page.evaluate(`(() => {
          const g = getComputedStyle(document.querySelector('${TAGLINE}'))
          return [g.opacity, g.transform]
        })()`)
        assert.deepEqual(style, ['1', 'none'], JSON.stringify(style))
      } finally {
        await ctx.close()
      }
    },

    async 'the submit button stays above the fold at 414×896 and 360×740'() {
      for (const [w, h] of [
        [414, 896],
        [360, 740],
      ]) {
        const ctx = await phone(w, h)
        const page = await ctx.newPage()
        try {
          for (const route of ROUTES) {
            await page.goto(`${APP_URL}/${route}`)
            await page.locator(TAGLINE).waitFor()
            await page.waitForTimeout(600)
            const box = await page
              .locator('button[type="submit"]')
              .boundingBox()
            assert.ok(box, 'submit')
            assert.ok(
              box.y + box.height <= h,
              `${route} at ${w}×${h}: submit bottom ${Math.round(box.y + box.height)}`,
            )
            assert.equal(
              await page.evaluate('document.documentElement.scrollWidth'),
              w,
              'horizontal scroll',
            )
          }
        } finally {
          await ctx.close()
        }
      }
    },
  },
  { teardown: closeBrowser },
)
