'use client'

import Link from 'next/link'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

import { ChevronRightIcon, DumbbellIcon, SwapIcon } from '@/components/icons'
import { StaggerItem, StaggerList } from '@/components/motion'
import {
  splitTargetMuscles,
  type CatalogCategory,
  type CatalogSubcategory,
} from '@/lib/catalog-types'

function countExercises(category: CatalogCategory) {
  return category.subcategories.reduce((n, s) => n + s.exercises.length, 0)
}

/**
 * Workouts reads as an editorial reference, not a tool.
 *
 * The previous version boxed a card inside a card: a `.surface` article per
 * subcategory, with a second tinted container holding the exercise rows. Both
 * are gone. A subcategory is now a heading with an accent rail, its guidance is
 * plain body text, and the variations are an unboxed divided list. Hierarchy is
 * carried by type size, weight and whitespace instead of borders — which is
 * also strictly cheaper to paint.
 */
function SubcategorySection({
  subcategory,
}: {
  subcategory: CatalogSubcategory
}) {
  const muscles = splitTargetMuscles(subcategory.target_muscle)

  return (
    <article className="border-l-2 border-danger/40 pl-4">
      <h3 className="text-[19px] leading-snug font-bold tracking-tight text-primary">
        {subcategory.name}
      </h3>

      {/* Target muscles as inline chips — denser and lighter than a bullet list */}
      <div className="mt-3">
        <h4 className="label-caps">Target Muscles</h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {muscles.map((muscle) => (
            <span
              key={muscle}
              className="rounded-full border border-hairline bg-card/60 px-2.5 py-1 text-[12px] text-secondary"
            >
              {muscle}
            </span>
          ))}
        </div>
      </div>

      <h4 className="label-caps mt-4">How to Perform</h4>
      <p className="mt-2 text-[14px] leading-relaxed text-secondary">
        {subcategory.how_to_perform}
      </p>

      {/*
       * Variations. Everything under one subcategory trains the same pattern
       * with the same technique, so these are interchangeable substitutes.
       */}
      <div className="mt-4 flex items-center gap-2">
        <SwapIcon className="h-3.5 w-3.5 text-faint" />
        <span className="text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          {subcategory.exercises.length} interchangeable
        </span>
      </div>

      <ul className="mt-1">
        {subcategory.exercises.map((exercise) => (
          <li key={exercise.id} className="border-b border-hairline/50">
            <Link
              href={`/workouts/${exercise.id}`}
              className="group flex items-center gap-3 py-3 transition-colors active:opacity-70"
            >
              <DumbbellIcon className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-danger" />
              <span className="flex-1 text-[15px] text-primary">
                {exercise.name}
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function CatalogBrowser({
  categories,
}: {
  categories: CatalogCategory[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const reduced = useReducedMotion()

  return (
    <StaggerList className="divide-y divide-hairline/70">
      {categories.map((category) => {
        const open = openId === category.id
        const exercises = countExercises(category)

        return (
          <StaggerItem key={category.id}>
            <section>
              <h2>
                {/*
                 * An index row, not a card: the name carries the weight and a
                 * hairline separates entries. whileTap gives the press feedback
                 * the card's hover state used to imply.
                 */}
                <m.button
                  type="button"
                  onClick={() => setOpenId(open ? null : category.id)}
                  aria-expanded={open}
                  aria-controls={`category-${category.id}`}
                  whileTap={reduced ? undefined : { scale: 0.985 }}
                  transition={{ duration: 0.12 }}
                  className="flex w-full items-baseline gap-4 py-5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[26px] leading-none font-bold tracking-tight transition-colors ${
                        open ? 'text-danger' : 'text-primary'
                      }`}
                    >
                      {category.name}
                    </span>
                    <span className="mt-2 block text-[12px] font-semibold tracking-[0.1em] text-faint uppercase">
                      {category.subcategories.length} groups · {exercises}{' '}
                      exercises
                    </span>
                  </span>

                  <ChevronRightIcon
                    className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-90 text-danger' : 'text-faint'
                    }`}
                  />
                </m.button>
              </h2>

              <AnimatePresence initial={false}>
                {open && (
                  <m.div
                    id={`category-${category.id}`}
                    initial={reduced ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-7 pb-6"
                  >
                    {category.subcategories.map((subcategory) => (
                      <SubcategorySection
                        key={subcategory.id}
                        subcategory={subcategory}
                      />
                    ))}
                  </m.div>
                )}
              </AnimatePresence>
            </section>
          </StaggerItem>
        )
      })}
    </StaggerList>
  )
}
