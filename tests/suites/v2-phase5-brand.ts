/**
 * V2 Phase 5.3 — the Ezlyfts rename, checked statically: no user-facing
 * "AJFit" left in code, the manifest and icons, and a bumped service-worker
 * cache so installed apps drop the old art.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import { suite } from '../lib/harness'
import manifest from '@/app/manifest'
import { BRAND } from '@/lib/brand'

const root = path.resolve(__dirname, '../..')

/**
 * Where "AJFit" may still appear, and why. Everything else under src/ and
 * public/ must be clean.
 *   - ajfit-* cookie and storage keys: infrastructure (D12); renaming them
 *     would sign everyone's timezone and pending writes out of existence.
 *   - docs/AJFit_*.md references in comments: the files keep their names.
 *   - the service worker's note on why the cache was bumped.
 *   - brand.ts's comment recording the rename.
 */
const ALLOWED = [
  /'ajfit-tz'/,
  /'ajfit-onboarding-later'/,
  /`ajfit-pending-writes:/,
  /docs\/AJFit_[A-Za-z_]+\.md/,
  /keep serving the old AJFit art/,
  // brand.ts's own comment explaining the rename and what was kept.
  /AJFit is now Ezlyfts/,
  /the `ajfit-\*` cookie and cache keys/,
]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return files(full)
    return /\.(tsx?|js|mjs|css|json|webmanifest)$/.test(name) ? [full] : []
  })
}

export default suite('v2-phase5-brand', {
  'no user-facing AJFit / AJ Fit left in src or public'() {
    const offenders: string[] = []
    for (const file of [
      ...files(path.join(root, 'src')),
      ...files(path.join(root, 'public')),
    ]) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!/aj ?fit/i.test(line)) return
          if (ALLOWED.some((ok) => ok.test(line))) return
          offenders.push(
            `${path.relative(root, file)}:${i + 1}: ${line.trim()}`,
          )
        })
    }
    assert.deepEqual(offenders, [])
  },

  'brand constants and the manifest say Ezlyfts / Ez'() {
    assert.deepEqual(BRAND, {
      name: 'Ezlyfts',
      shortName: 'Ezlyfts',
      monogram: 'Ez',
    })
    const m = manifest()
    assert.equal(m.name, 'Ezlyfts')
    assert.equal(m.short_name, 'Ezlyfts')
  },

  'the service worker cache moved past v1'() {
    const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8')
    const version = sw.match(/const CACHE = '([a-z]+)-shell-v(\d+)'/)
    assert.ok(version, 'CACHE constant not found')
    assert.equal(version[1], 'ezlyfts')
    assert.ok(Number(version[2]) >= 2)
  },

  async 'every icon exists at its declared size and shape'() {
    const expected: [string, number, boolean][] = [
      ['public/icon-192.png', 192, true],
      ['public/icon-512.png', 512, true],
      ['public/icon-192-maskable.png', 192, false],
      ['public/icon-512-maskable.png', 512, false],
      ['public/apple-touch-icon.png', 180, false],
    ]
    for (const [file, size, alpha] of expected) {
      const meta = await sharp(path.join(root, file)).metadata()
      assert.equal(meta.width, size, file)
      assert.equal(meta.height, size, file)
      // Maskable and iOS icons must be full-bleed, with no transparency.
      assert.equal(!!meta.hasAlpha, alpha, `${file} alpha`)
    }
    const ico = readFileSync(path.join(root, 'src/app/favicon.ico'))
    assert.equal(ico.readUInt16LE(2), 1, 'favicon is not an ICO')
    assert.equal(ico.readUInt16LE(4), 4, 'favicon should carry 4 sizes')
  },
})
