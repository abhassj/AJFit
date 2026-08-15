import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from '@/components/skeleton'

/**
 * Home's loading state, and the fallback for any (app) route without its own.
 *
 * Mirrors the dashboard: the weekly segment bar, the two-up stat cards and the
 * month grid, at the heights they actually render at.
 */
export default function HomeLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />

      {/* Weekly summary — seven segments and their day labels. */}
      <section className="py-2">
        <SkeletonBlock className="h-3 w-44" />
        <div className="mt-3.5 flex gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonBlock key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonBlock key={i} className="h-2.5 flex-1" />
          ))}
        </div>
        <SkeletonBlock className="mt-3.5 h-3.5 w-36" />
      </section>

      {/* Workouts-completed stat pair. */}
      <section className="py-2">
        <SkeletonBlock className="h-3 w-40" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-[92px]" />
          <SkeletonBlock className="h-[92px]" />
        </div>
      </section>

      {/* Month calendar. */}
      <section className="py-2">
        <SkeletonBlock className="h-3 w-28" />
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => (
            <SkeletonBlock key={i} className="aspect-square" />
          ))}
        </div>
      </section>

      <SkeletonBlock className="mt-5 h-[52px]" />
    </SkeletonPage>
  )
}
