/**
 * V2 Phase 2 — the pure pieces: personal-record comparison, the set count in a
 * prescription, the Mon–Sun week used by the weekly lock, and replaying queued
 * writes after a reload.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { shortWeekday, weekBounds } from '@/lib/home-types'
import { isNewRecord } from '@/lib/pr-types'
import { prescribedSetCount, type SessionExercise } from '@/lib/session-types'
import { applyWrite, type SessionWrite } from '@/lib/session-write-types'

const record = { weight_kg: 60, reps: 8, achieved_on: '2026-09-01' }
const lift = (weight: number | null, reps: number | null) => ({
  weight,
  reps_done: reps,
})

export default suite('v2-phase2-unit', {
  'a heavier set beats the record; a lighter one does not'() {
    assert.equal(isNewRecord(lift(62.5, 3), [], record), true)
    assert.equal(isNewRecord(lift(55, 12), [], record), false)
  },

  'at equal weight, more reps beats the record (D4 tie rule)'() {
    assert.equal(isNewRecord(lift(60, 9), [], record), true)
    assert.equal(isNewRecord(lift(60, 8), [], record), false)
  },

  'only the set that raised the bar is marked'() {
    const earlier = [lift(65, 5)]
    assert.equal(isNewRecord(lift(62.5, 5), earlier, record), false)
    assert.equal(isNewRecord(lift(67.5, 3), earlier, record), true)
  },

  'no stored record, or a bodyweight set, earns no badge'() {
    assert.equal(isNewRecord(lift(100, 5), [], undefined), false)
    assert.equal(isNewRecord(lift(null, 20), [], record), false)
    assert.equal(isNewRecord(lift(0, 20), [], record), false)
  },

  'the set count is read from the prescription when it names one'() {
    assert.equal(prescribedSetCount('3x10'), 3)
    assert.equal(prescribedSetCount('4 × 8-12'), 4)
    assert.equal(prescribedSetCount(' 5X5'), 5)
    assert.equal(prescribedSetCount('AMRAP'), null)
    assert.equal(prescribedSetCount(null), null)
  },

  'the lock week runs Monday to Sunday, across month and year ends'() {
    assert.deepEqual(weekBounds('2026-10-12'), {
      start: '2026-10-12',
      end: '2026-10-18',
    })
    assert.deepEqual(weekBounds('2026-10-18'), {
      start: '2026-10-12',
      end: '2026-10-18',
    })
    assert.deepEqual(weekBounds('2027-01-01'), {
      start: '2026-12-28',
      end: '2027-01-03',
    })
    // London's DST change (25 Oct 2026) does not shift the week.
    assert.deepEqual(weekBounds('2026-10-25'), {
      start: '2026-10-19',
      end: '2026-10-25',
    })
  },

  'short weekday labels'() {
    assert.equal(shortWeekday('2026-10-12'), 'Mon')
    assert.equal(shortWeekday('2026-10-18'), 'Sun')
  },

  'replaying writes reproduces the screen, and a replayed set never doubles'() {
    const base: SessionExercise[] = [
      {
        id: 'e1',
        program_exercise_id: null,
        status: 'pending',
        completed_at: null,
        comment: null,
        exercise_name: 'Lat Pulldown',
        prescribed_reps: '3x10',
        rest_seconds: null,
        exercise_order: 1,
        sets: [],
      },
    ]
    const writes: SessionWrite[] = [
      {
        kind: 'logSet',
        setId: 's1',
        exerciseId: 'e1',
        setNumber: 1,
        reps: 10,
        weight: 40,
      },
      {
        kind: 'logSet',
        setId: 's2',
        exerciseId: 'e1',
        setNumber: 2,
        reps: 8,
        weight: 45,
      },
      {
        kind: 'updateSet',
        setId: 's1',
        exerciseId: 'e1',
        reps: 10,
        weight: 42.5,
      },
      { kind: 'comment', exerciseId: 'e1', comment: '  felt good ' },
      {
        kind: 'status',
        exerciseId: 'e1',
        status: 'completed',
        completedAt: 'T',
      },
    ]
    // Persisted as JSON, read back after the reload.
    const restored = JSON.parse(JSON.stringify(writes)) as SessionWrite[]
    const once = restored.reduce(applyWrite, base)
    const twice = restored.reduce(applyWrite, once)
    assert.deepEqual(twice, once)
    assert.deepEqual(
      once[0].sets.map((s) => [s.set_number, s.reps_done, s.weight]),
      [
        [1, 10, 42.5],
        [2, 8, 45],
      ],
    )
    assert.equal(once[0].comment, 'felt good')
    assert.equal(once[0].status, 'completed')
  },
})
