/**
 * Viewer-timezone resolution. Kolkata (+05:30), London (DST) and Muscat (fixed
 * +04:00) are the zones the release checklist names.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { dateKey } from '@/lib/home-types'
import { resolveTimeZone, zonedDateKey, zonedNow } from '@/lib/timezone'

// 20:52 UTC on 14 August 2026 — 02:22 on the 15th in Kolkata.
const LATE_UTC = new Date(Date.UTC(2026, 7, 14, 20, 52))

export default suite('timezone', {
  'Kolkata is already tomorrow late in the UTC evening'() {
    assert.equal(zonedDateKey('Asia/Kolkata', LATE_UTC), '2026-08-15')
    assert.equal(zonedNow('Asia/Kolkata', LATE_UTC).getHours(), 2)
    assert.equal(zonedNow('Asia/Kolkata', LATE_UTC).getMinutes(), 22)
  },

  'London follows BST in summer and GMT in winter'() {
    assert.equal(zonedNow('Europe/London', LATE_UTC).getHours(), 21)
    const winter = new Date(Date.UTC(2026, 11, 31, 23, 30))
    assert.equal(zonedDateKey('Europe/London', winter), '2026-12-31')
  },

  'Muscat is a fixed +04:00'() {
    assert.equal(zonedDateKey('Asia/Muscat', LATE_UTC), '2026-08-15')
    assert.equal(zonedNow('Asia/Muscat', LATE_UTC).getHours(), 0)
    const early = new Date(Date.UTC(2026, 7, 14, 19, 59))
    assert.equal(zonedDateKey('Asia/Muscat', early), '2026-08-14')
  },

  'midnight never renders as hour 24'() {
    const midnightKolkata = new Date(Date.UTC(2026, 7, 14, 18, 30))
    const d = zonedNow('Asia/Kolkata', midnightKolkata)
    assert.equal(dateKey(d), '2026-08-15')
    assert.equal(d.getHours(), 0)
  },

  'garbage and hostile zone values fall back to UTC'() {
    assert.equal(resolveTimeZone(undefined), 'UTC')
    assert.equal(resolveTimeZone('Not/AZone'), 'UTC')
    assert.equal(resolveTimeZone('Asia/Kolkata\r\nSet-Cookie: x'), 'UTC')
    assert.equal(resolveTimeZone(' Asia/Kolkata '), 'Asia/Kolkata')
  },
})
