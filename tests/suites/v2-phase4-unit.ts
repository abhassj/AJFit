/**
 * V2 Phase 4 — BMI against hand calculation at every band edge, and the
 * unit-aware bodyweight / height parsers.
 *
 * Hand calculation, height 180 cm → 1.80² = 3.24 m²:
 *   59.6 / 3.24 = 18.395… → 18.4  below the typical range
 *   59.94 / 3.24 = 18.5          → 18.5  within        (edge: 18.5 is in)
 *   80.8 / 3.24 = 24.938… → 24.9  within
 *   81.0 / 3.24 = 25.0           → 25.0  above         (edge: 25 is above)
 *   97.0 / 3.24 = 29.938… → 29.9  above
 *   97.2 / 3.24 = 30.0           → 30.0  well above    (edge: 30 is well above)
 * And 59.9 / 3.24 = 18.487… displays as 18.5, so it is classed with 18.5.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { BMI_NOTE, bmiGaugePosition, computeBmi } from '@/lib/bmi'
import {
  parseBodyweightIn,
  parseHeightCm,
  parseHeightFtIn,
} from '@/lib/validation'

const at180 = (kg: number) => computeBmi(kg, 180)

export default suite('v2-phase4-unit', {
  'BMI band edges match hand calculation'() {
    const cases: [number, number, string][] = [
      [59.6, 18.4, 'under'],
      [59.94, 18.5, 'healthy'],
      [80.8, 24.9, 'healthy'],
      [81.0, 25.0, 'over'],
      [97.0, 29.9, 'over'],
      [97.2, 30.0, 'obese'],
    ]
    for (const [kg, value, band] of cases) {
      const r = at180(kg)!
      assert.equal(r.value, value, `${kg} kg`)
      assert.equal(r.band, band, `${kg} kg → ${value}`)
    }
  },

  'the band follows the displayed (rounded) value'() {
    const r = at180(59.9)!
    assert.equal(r.value, 18.5)
    assert.equal(r.band, 'healthy')
  },

  'missing or zero measurements give no result'() {
    assert.equal(computeBmi(null, 180), null)
    assert.equal(computeBmi(80, null), null)
    assert.equal(computeBmi(0, 180), null)
  },

  'copy is neutral and carries the D13 note'() {
    for (const kg of [50, 70, 90, 120]) {
      const r = at180(kg)!
      assert.doesNotMatch(r.comment, /lose|diet\b|cut|reduce/i, r.comment)
    }
    assert.match(BMI_NOTE, /muscle from fat/)
    assert.match(BMI_NOTE, /adults/)
  },

  'the gauge position clamps to its scale'() {
    assert.equal(bmiGaugePosition(5), 0)
    assert.equal(bmiGaugePosition(60), 1)
    assert.equal(bmiGaugePosition(27), 0.5)
  },

  'bodyweight in lbs is stored as kg and checked in kg'() {
    const r = parseBodyweightIn('160', 'lbs')
    assert.ok(r.ok && Math.abs(r.value - 72.5747792) < 1e-6)
    const tooLight = parseBodyweightIn('40', 'lbs') // 18.1 kg
    assert.equal(tooLight.ok, false)
    assert.match(!tooLight.ok ? tooLight.error : '', /between 45 and 1102 lbs/)
    assert.deepEqual(parseBodyweightIn('72.5', 'kg'), { ok: true, value: 72.5 })
  },

  'height in cm or feet/inches becomes centimetres'() {
    assert.deepEqual(parseHeightCm('178'), { ok: true, value: 178 })
    assert.equal(parseHeightCm('30').ok, false)
    const ftin = parseHeightFtIn('5', '11')
    assert.ok(ftin.ok && Math.abs(ftin.value - 180.34) < 1e-9)
    assert.equal(parseHeightFtIn('5', '12').ok, false)
    assert.equal(parseHeightFtIn('5.5', '0').ok, false)
    const noInches = parseHeightFtIn('6', '')
    assert.ok(noInches.ok && Math.abs(noInches.value - 182.88) < 1e-9)
  },
})
