'use client'

import Link from 'next/link'
import { useState } from 'react'

import { StaggerItem, StaggerList } from '@/components/motion'

import {
  ChevronDownIcon,
  ChevronRightIcon,
  DumbbellIcon,
  SwapIcon,
  TargetIcon,
} from '@/components/icons'
import {
  splitTargetMuscles,
  type CatalogCategory,
  type CatalogSubcategory,
} from '@/lib/catalog-types'

function countExercises(category: CatalogCategory) {
  return category.subcategories.reduce((n, s) => n + s.exercises.length, 0)
}

/**
 * The design doc's "subcategory info card + exercise list": one shared card
 * carrying the technique guidance, with the individual variations listed
 * underneath as rows.
 */
function SubcategoryCard({ subcategory }: { subcategory: CatalogSubcategory }) {
  const muscles = splitTargetMuscles(subcategory.target_muscle)

  return (
    <article className="surface overflow-hidden rounded-2xl">
      <div className="space-y-5 p-5">
        <h3 className="text-xl leading-snug font-bold tracking-tight text-primary">
          {subcategory.name}
        </h3>

        <section>
          <div className="flex items-center gap-2">
            <TargetIcon className="h-3.5 w-3.5 text-faint" />
            <h4 className="label-caps">Target Muscles</h4>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {muscles.map((muscle) => (
              <li
                key={muscle}
                className="flex items-start gap-2.5 text-[15px] text-primary/90"
              >
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-danger" />
                {muscle}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="label-caps">How to Perform</h4>
          <p className="mt-2.5 text-[15px] leading-relaxed text-secondary">
            {subcategory.how_to_perform}
          </p>
        </section>
      </div>

      {/*
       * Variations list. The framing here is the point: everything under one
       * subcategory trains the same pattern with the same technique, so these
       * rows are interchangeable substitutes rather than distinct movements.
       */}
      <div className="border-t border-hairline bg-card-raised/40">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3">
          <SwapIcon className="h-3.5 w-3.5 text-faint" />
          <h4 className="label-caps">
            {subcategory.exercises.length} Interchangeable Variations
          </h4>
        </div>
        <p className="px-5 pb-4 text-[13px] leading-relaxed text-faint">
          Any of these train the same pattern — pick whichever your gym has
          free.
        </p>

        <ul>
          {subcategory.exercises.map((exercise) => (
            <li key={exercise.id} className="border-t border-hairline/60">
              <Link
                href={`/workouts/${exercise.id}`}
                className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-card-raised active:bg-card-raised"
              >
                <DumbbellIcon className="h-5 w-5 shrink-0 text-faint transition-colors group-hover:text-danger" />
                <span className="flex-1 text-[15px] text-primary">
                  {exercise.name}
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function CatalogBrowser({
  categories,
}: {
  categories: CatalogCategory[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <StaggerList className="space-y-3">
      {categories.map((category) => {
        const open = openId === category.id
        const exercises = countExercises(category)

        return (
          <StaggerItem key={category.id}>
            <section>
              <h2>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : category.id)}
                  aria-expanded={open}
                  aria-controls={`category-${category.id}`}
                  className={`surface flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors ${
                    open ? 'border-danger/40' : 'hover:bg-card-raised/90'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold tracking-tight text-primary">
                      {category.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-secondary">
                      {category.subcategories.length} groups · {exercises}{' '}
                      exercises
                    </span>
                  </span>

                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-180 text-danger' : 'text-faint'
                    }`}
                  />
                </button>
              </h2>

              {open && (
                <div
                  id={`category-${category.id}`}
                  className="mt-3 space-y-3 pl-3"
                >
                  {category.subcategories.map((subcategory) => (
                    <SubcategoryCard
                      key={subcategory.id}
                      subcategory={subcategory}
                    />
                  ))}
                </div>
              )}
            </section>
          </StaggerItem>
        )
      })}
    </StaggerList>
  )
}
