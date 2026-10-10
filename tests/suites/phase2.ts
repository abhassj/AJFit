/**
 * Phase 2 — the Exercises page's catalog: shape, ordering and the deliberate
 * duplicates the page relies on.
 */
import assert from 'node:assert/strict'

import { suite } from '../lib/harness'
import { sql, sqlValue } from '../lib/local'

/*
 * Catalog size. Bump these only alongside a catalog migration, and say which
 * one in a comment so the history of the number is readable here.
 *   v1 seed:                                     6 / 26 / 86
 *   20260811202318 (Push-Ups):                   6 / 26 / 87
 *   20261010120100 (v2 unilateral Arms, +11):    6 / 26 / 98
 */
const CATEGORIES = 6
const SUBCATEGORIES = 26
// Was 87 before v2; the unilateral Arms migration adds 11 (see above).
const EXERCISES = 98

export default suite('phase2', {
  'catalog has the expected counts'() {
    assert.equal(
      Number(sqlValue('select count(*) from public.categories')),
      CATEGORIES,
    )
    assert.equal(
      Number(sqlValue('select count(*) from public.subcategories')),
      SUBCATEGORIES,
    )
    assert.equal(
      Number(sqlValue('select count(*) from public.exercises')),
      EXERCISES,
    )
  },

  'categories are ordered Chest → Abs & Core'() {
    const names = sql(
      'select name from public.categories order by sort_order',
    ).map((r) => r[0])
    assert.deepEqual(names, [
      'Chest',
      'Back',
      'Shoulders',
      'Legs',
      'Arms',
      'Abs & Core',
    ])
  },

  'every subcategory has a unique, non-zero sort order within its category'() {
    const dupes = sqlValue(`select count(*) from (
      select category_id, sort_order from public.subcategories
      group by 1, 2 having count(*) > 1) d`)
    assert.equal(dupes, '0')
    assert.equal(
      sqlValue(
        'select count(*) from public.subcategories where sort_order = 0',
      ),
      '0',
    )
  },

  'every subcategory carries technique guidance'() {
    assert.equal(
      sqlValue(`select count(*) from public.subcategories
                where coalesce(target_muscle, '') = '' or coalesce(how_to_perform, '') = ''`),
      '0',
    )
  },

  'Romanian Deadlift is catalogued under both Back and Legs'() {
    const cats = sql(`select c.name from public.exercises e
      join public.subcategories s on s.id = e.subcategory_id
      join public.categories c on c.id = s.category_id
      where e.name = 'Romanian Deadlift (RDL)' order by c.sort_order`).map(
      (r) => r[0],
    )
    assert.deepEqual(cats, ['Back', 'Legs'])
  },

  'Push-Ups sits under Chest > Flat Press Variations'() {
    assert.equal(
      sqlValue(`select s.name from public.exercises e
        join public.subcategories s on s.id = e.subcategory_id
        where e.name = 'Push-Ups'`),
      'Flat Press Variations',
    )
  },
})
