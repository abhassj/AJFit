/**
 * V2 Phase 3.3 — workout initials for the weekly bar (decision D7).
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { dayInitials } from '@/lib/home-types'

export default suite('v2-phase3-unit', {
  'the plan’s examples'() {
    assert.equal(dayInitials('Back & Biceps'), 'BB')
    assert.equal(dayInitials('Chest & Tri'), 'CT')
    assert.equal(dayInitials('Shoulders & Legs'), 'SL')
    assert.equal(dayInitials('Shoulder, Legs & Core'), 'SLC')
    assert.equal(dayInitials('Legs'), 'LE')
  },

  'every separator: and, comma, plus, slash'() {
    assert.equal(dayInitials('Back and Biceps'), 'BB')
    assert.equal(dayInitials('Push + Core'), 'PC')
    assert.equal(dayInitials('Upper/Lower'), 'UL')
    assert.equal(dayInitials('Chest,Back'), 'CB')
  },

  'at most three letters'() {
    assert.equal(dayInitials('Chest, Back, Arms & Abs'), 'CBA')
  },

  '"and" inside a word is not a separator'() {
    assert.equal(dayInitials('Handstands'), 'HA')
    assert.equal(dayInitials('Bands & Core'), 'BC')
  },

  'one part of several words takes each word’s initial'() {
    assert.equal(dayInitials('Upper Body'), 'UB')
    assert.equal(dayInitials('  full   body  '), 'FB')
  },

  'missing or empty titles give null'() {
    assert.equal(dayInitials(null), null)
    assert.equal(dayInitials(undefined), null)
    assert.equal(dayInitials('   '), null)
    assert.equal(dayInitials(' & '), null)
  },
})
