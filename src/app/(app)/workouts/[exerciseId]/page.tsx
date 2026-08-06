import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DumbbellIcon,
  SwapIcon,
  TargetIcon,
} from '@/components/icons'
import { getExercise } from '@/lib/catalog'
import { splitTargetMuscles } from '@/lib/catalog-types'

type PageProps = { params: Promise<{ exerciseId: string }> }

export async function generateMetadata({ params }: PageProps) {
  const { exerciseId } = await params
  const exercise = await getExercise(exerciseId)
  return { title: exercise ? `${exercise.name} · AJFit` : 'Exercise · AJFit' }
}

export default async function ExerciseDetailPage({ params }: PageProps) {
  const { exerciseId } = await params
  const exercise = await getExercise(exerciseId)

  if (!exercise) {
    notFound()
  }

  const { subcategory } = exercise
  const muscles = splitTargetMuscles(subcategory.target_muscle)

  return (
    <main className="px-4 pt-6">
      <Link
        href="/workouts"
        className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Catalog
      </Link>

      <header className="px-1 pt-4 pb-6">
        {/* The exercise inherits everything below from this subcategory. */}
        <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          {subcategory.category.name}
        </p>
        <p className="mt-1.5 text-sm font-medium text-danger">
          {subcategory.name}
        </p>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight text-primary">
          {exercise.name}
        </h1>
      </header>

      <div className="space-y-3">
        <section className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <TargetIcon className="h-3.5 w-3.5 text-faint" />
            <h2 className="label-caps">Target Muscles</h2>
          </div>
          <ul className="mt-3 space-y-2">
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

        <section className="surface rounded-2xl p-5">
          <h2 className="label-caps">How to Perform</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-primary/85">
            {subcategory.how_to_perform}
          </p>
        </section>

        {subcategory.siblings.length > 0 && (
          <section className="surface overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 px-5 pt-5 pb-2.5">
              <SwapIcon className="h-3.5 w-3.5 text-faint" />
              <h2 className="label-caps">Swap For</h2>
            </div>
            <p className="px-5 pb-4 text-[13px] leading-relaxed text-faint">
              Same pattern, same technique — these are direct substitutes for{' '}
              {exercise.name}.
            </p>
            <ul>
              {subcategory.siblings.map((sibling) => (
                <li key={sibling.id} className="border-t border-hairline/60">
                  <Link
                    href={`/workouts/${sibling.id}`}
                    className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-card-raised"
                  >
                    <DumbbellIcon className="h-5 w-5 shrink-0 text-faint transition-colors group-hover:text-danger" />
                    <span className="flex-1 text-[15px] text-primary">
                      {sibling.name}
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
