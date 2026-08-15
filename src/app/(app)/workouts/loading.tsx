import {
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from '@/components/skeleton'

/**
 * Catalog loading state — the six category cards, at the tall aspect the
 * illustrated tiles render at so nothing reflows when the images arrive.
 */
export default function WorkoutsLoading() {
  return (
    <SkeletonPage>
      <SkeletonHeader wide />
      <SkeletonBlock className="mb-4 h-3.5 w-52" />

      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBlock key={i} className="h-28" />
        ))}
      </div>
    </SkeletonPage>
  )
}
