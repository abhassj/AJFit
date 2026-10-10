/**
 * V2 Phase 0 — unit conversion. Storage is metric at full precision; rounding
 * happens only at display, so round trips are exact.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  cmToFtIn,
  displayWeight,
  formatHeight,
  formatWeight,
  fromKg,
  ftInToCm,
  parseWeightInput,
  roundForDisplay,
  toKg,
} from '@/lib/units'

export default suite('v2-units', {
  'kg is the identity'() {
    assert.equal(toKg(82.5, 'kg'), 82.5)
    assert.equal(fromKg(82.5, 'kg'), 82.5)
    assert.equal(formatWeight(82.5, 'kg'), '82.5 kg')
  },

  '135 lb → kg → lb round-trips to 135'() {
    const stored = toKg(135, 'lbs')
    assert.ok(Math.abs(stored - 61.23496995) < 1e-8)
    assert.equal(displayWeight(stored, 'lbs'), '135')
  },

  'every whole and half pound from 0.5 to 1000 round-trips'() {
    for (let lb = 0.5; lb <= 1000; lb += 0.5) {
      assert.equal(
        displayWeight(toKg(lb, 'lbs'), 'lbs'),
        roundForDisplay(lb),
        `${lb} lb`,
      )
    }
  },

  'every kg entry to 0.25 survives display in kg'() {
    for (let kg = 0.25; kg <= 500; kg += 0.25) {
      assert.equal(
        displayWeight(parseWeightInput(String(kg), 'kg')!, 'kg'),
        roundForDisplay(kg),
      )
    }
  },

  'display rounds to one decimal and drops ".0"'() {
    assert.equal(roundForDisplay(60), '60')
    assert.equal(roundForDisplay(22.5), '22.5')
    assert.equal(roundForDisplay(22.46), '22.5')
    assert.equal(roundForDisplay(-0.01), '0')
    assert.equal(formatWeight(20, 'lbs'), '44.1 lbs')
    assert.equal(formatWeight(null, 'kg'), '')
  },

  'blank input parses to null'() {
    assert.equal(parseWeightInput('', 'lbs'), null)
    assert.equal(parseWeightInput('  ', 'kg'), null)
  },

  'heights convert between cm and feet/inches'() {
    assert.deepEqual(cmToFtIn(180.34), { ft: 5, in: 11 })
    assert.deepEqual(cmToFtIn(182.88), { ft: 6, in: 0 })
    assert.ok(Math.abs(ftInToCm(5, 11) - 180.34) < 1e-9)
    assert.equal(formatHeight(180.34, 'ft'), '5′11″')
    assert.equal(formatHeight(180.34, 'cm'), '180 cm')
    // 5′11.9″ rounds to 6′0″, never "5′12″".
    assert.deepEqual(cmToFtIn(ftInToCm(5, 11.9)), { ft: 6, in: 0 })
  },

  'every ft/in height round-trips'() {
    for (let ft = 3; ft <= 8; ft++) {
      for (let inch = 0; inch < 12; inch++) {
        assert.deepEqual(cmToFtIn(ftInToCm(ft, inch)), { ft, in: inch })
      }
    }
  },
})
