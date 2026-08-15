import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from '@/components/skeleton'

/**
 * Start-workout loading state.
 *
 * This route resolves to one of three quite different screens (pre-start, live
 * session, finished summary), so the skeleton stays at the shape they share —
 * a heading and one tall panel — rather than guessing at a layout that will be
 * wrong two times in three.
 */
export default function StartLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader wide />
      <SkeletonBlock className="h-44 rounded-2xl" />
      <SkeletonBlock className="mt-3 h-[52px]" />
      <SkeletonBlock className="mt-3 h-[52px]" />
    </SkeletonPage>
  )
}
