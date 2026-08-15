import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from '@/components/skeleton'

/**
 * Split builder loading state — seven collapsed day rows, matching the height
 * of the real day rail rows.
 */
export default function ProgramLoading() {
  return (
    <SkeletonPage>
      <div className="flex items-start justify-between gap-3">
        <SkeletonHeader wide />
        <SkeletonBlock className="mt-1 h-11 w-11 shrink-0" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[74px] rounded-2xl" />
        ))}
      </div>
    </SkeletonPage>
  )
}
