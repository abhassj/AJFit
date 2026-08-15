import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from '@/components/skeleton'

/**
 * Profile loading state — avatar, identity fields, then the bodyweight block.
 */
export default function ProfileLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader />

      <div className="flex items-center gap-4">
        <SkeletonBlock className="h-20 w-20 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3 w-44" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <SkeletonBlock className="h-[70px]" />
        <SkeletonBlock className="h-[70px]" />
        <SkeletonBlock className="h-[52px]" />
      </div>

      <SkeletonBlock className="mt-5 h-40 rounded-2xl" />
    </SkeletonPage>
  )
}
