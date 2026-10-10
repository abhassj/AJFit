/**
 * Phase 6 — installability: the manifest, its icons, the service worker, and
 * the proxy matcher that must let both through without a session.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { suite } from '../lib/harness'
import manifest from '@/app/manifest'

const root = path.resolve(__dirname, '../..')

export default suite('phase6', {
  'manifest is standalone with any and maskable icons'() {
    const m = manifest()
    assert.equal(m.display, 'standalone')
    assert.equal(m.start_url, '/')
    const purposes = new Set(m.icons?.map((i) => i.purpose))
    assert.ok(purposes.has('any') && purposes.has('maskable'))
  },

  'every manifest icon exists in /public'() {
    for (const icon of manifest().icons ?? []) {
      assert.ok(existsSync(path.join(root, 'public', icon.src)), icon.src)
    }
  },

  'the service worker declares a versioned shell cache'() {
    const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8')
    assert.match(sw, /const CACHE = '[a-z]+-shell-v\d+'/)
  },

  'the proxy matcher skips the manifest and service worker'() {
    const proxy = readFileSync(path.join(root, 'src/proxy.ts'), 'utf8')
    assert.match(proxy, /manifest\.webmanifest/)
    assert.match(proxy, /sw\.js/)
  },
})
