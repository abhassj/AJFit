/**
 * Home — the calendar arithmetic behind the weekly bar and the month grid.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import {
  addDays,
  dateKey,
  monthGrid,
  startOfWeek,
  weekDates,
} from '@/lib/home-types'

export default suite('partHome', {
  'weeks start on Monday'() {
    // Sunday 11 Oct 2026 belongs to the week of Monday 5 Oct.
    assert.equal(dateKey(startOfWeek(new Date(2026, 9, 11))), '2026-10-05')
    assert.equal(dateKey(startOfWeek(new Date(2026, 9, 5))), '2026-10-05')
  },

  'weekDates spans Monday to Sunday with matching day names'() {
    const week = weekDates(new Date(2026, 9, 7))
    assert.equal(week.length, 7)
    assert.equal(dateKey(week[0].date), '2026-10-05')
    assert.equal(week[0].day_of_week, 'monday')
    assert.equal(dateKey(week[6].date), '2026-10-11')
    assert.equal(week[6].day_of_week, 'sunday')
  },

  'addDays crosses month and year boundaries'() {
    assert.equal(dateKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01')
    assert.equal(dateKey(addDays(new Date(2026, 2, 1), -1)), '2026-02-28')
  },

  'monthGrid pads to whole Monday-first weeks'() {
    const grid = monthGrid(2026, 9) // October 2026 starts on a Thursday
    assert.equal(grid.length % 7, 0)
    assert.equal(
      grid.slice(0, 3).every((c) => c === null),
      true,
    )
    assert.equal(dateKey(grid[3]!), '2026-10-01')
    assert.equal(grid.filter(Boolean).length, 31)
  },
})
