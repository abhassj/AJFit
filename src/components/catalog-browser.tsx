'use client'

import Link from 'next/link'
import Image from 'next/image'
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

const CATEGORY_IMAGES: Record<string, string> = {
  'Chest': '/category_chest.png',
  'Back': '/category_back.png',
  'Shoulders': '/category_shoulders.png',
  'Legs': '/category_legs.png',
  'Arms': '/category_arms.png',
  'Abs & Core': '/category_abs.png',
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
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl shadow-2xl">
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
              className="rounded-full border border-danger/20 bg-danger/10 px-2.5 py-1 text-[12px] text-primary/90"
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
          <li key={exercise.id} className="border-t border-white/10 first:border-t-0">
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
    <StaggerList className="space-y-4">
      {categories.map((category) => {
        const open = openId === category.id
        const exercises = countExercises(category)

        return (
          <StaggerItem key={category.id}>
            <section>
              <h2>
                <m.button
                  type="button"
                  onClick={() => setOpenId(open ? null : category.id)}
                  aria-expanded={open}
                  aria-controls={`category-${category.id}`}
                  whileTap={reduced ? undefined : { scale: 0.985 }}
                  transition={{ duration: 0.12 }}
                  className={`relative flex w-full items-center justify-between overflow-hidden rounded-2xl border bg-[#1a1d24] text-left transition-colors ${
                    open ? 'border-danger/40 ring-1 ring-danger/20' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="absolute inset-y-0 right-0 w-3/5 opacity-80">
                    <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#1a1d24] via-[#1a1d24]/50 to-transparent" />
                    {CATEGORY_IMAGES[category.name] && (
                      <Image
                        src={CATEGORY_IMAGES[category.name]}
                        alt=""
                        fill
                        className="object-cover object-right"
                        sizes="(max-width: 768px) 60vw, 300px"
                      />
                    )}
                  </div>

                  <span className="relative z-20 min-w-0 flex-1 p-5">
                    <span
                      className={`block text-[22px] uppercase leading-none font-black tracking-widest transition-colors ${
                        open ? 'text-danger drop-shadow-md' : 'text-primary drop-shadow-sm'
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
                    className={`relative z-20 mr-5 h-5 w-5 shrink-0 transition-transform duration-300 ${
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
                    className="mt-4 space-y-7 px-2 pb-6"
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
