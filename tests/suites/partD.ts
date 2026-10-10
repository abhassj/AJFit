/**
 * Part D — the shared input validators every form and the set keypad use.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  parseBodyweight,
  parseDayTitle,
  parseReps,
  parseRestSeconds,
  parseSplitName,
  parseWeight,
  validateSetEntry,
} from '@/lib/validation'

export default suite('partD', {
  'reps: blank is null, zero and decimals are rejected, cap at 999'() {
    assert.deepEqual(parseReps(''), { ok: true, value: null })
    assert.deepEqual(parseReps('12'), { ok: true, value: 12 })
    assert.equal(parseReps('0').ok, false)
    assert.equal(parseReps('2.5').ok, false)
    assert.equal(parseReps('1000').ok, false)
  },

  'weight: decimals allowed, capped'() {
    assert.deepEqual(parseWeight('22.5'), { ok: true, value: 22.5 })
    assert.deepEqual(parseWeight(''), { ok: true, value: null })
    assert.equal(parseWeight('2001').ok, false)
    assert.equal(parseWeight('-5').ok, false)
  },

  'a set needs reps or weight'() {
    assert.equal(validateSetEntry('', '').error, 'Enter reps or weight first.')
    assert.deepEqual(validateSetEntry('8', ''), {
      reps: 8,
      weight: null,
      error: null,
    })
    assert.deepEqual(validateSetEntry('', '20'), {
      reps: null,
      weight: 20,
      error: null,
    })
  },

  'rest seconds range'() {
    assert.deepEqual(parseRestSeconds(''), { ok: true, value: null })
    assert.deepEqual(parseRestSeconds('120'), { ok: true, value: 120 })
    assert.equal(parseRestSeconds('2').ok, false)
    assert.equal(parseRestSeconds('3601').ok, false)
  },

  'bodyweight range'() {
    assert.equal(parseBodyweight('70').ok, true)
    assert.equal(parseBodyweight('10').ok, false)
    assert.equal(parseBodyweight('600').ok, false)
  },

  'names and titles are trimmed and length-limited'() {
    assert.deepEqual(parseDayTitle('  Legs  '), { ok: true, value: 'Legs' })
    assert.deepEqual(parseDayTitle('   '), { ok: true, value: null })
    assert.equal(parseDayTitle('x'.repeat(61)).ok, false)
    assert.equal(parseSplitName('x'.repeat(61)).ok, false)
  },
})
