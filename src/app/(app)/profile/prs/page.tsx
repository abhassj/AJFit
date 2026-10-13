import Link from 'next/link'

import { ArrowLeftIcon } from '@/components/icons'
import { pageTitle } from '@/lib/brand'
import { formatLongDate } from '@/lib/home-types'
import { getViewerUnits } from '@/lib/profile'
import { getRecordsByCategory } from '@/lib/prs'
import { formatWeight } from '@/lib/units'

export const metadata = { title: pageTitle('Personal Records') }
export const dynamic = 'force-dynamic'

/**
 * Personal records, grouped by category in catalog order (V2 Phase 4.4).
 *
 * One call to exercise_prs(), which counts completed sessions only and
 * ignores sets without a positive weight — so bodyweight-only work never
 * appears, and the page says so rather than leaving people wondering where
 * their push-ups went. Category headings are plain text, not nested cards.
 */
export default async function PersonalRecordsPage() {
  const [groups, units] = await Promise.all([
    getRecordsByCategory(),
    getViewerUnits(),
  ])

  return (
    <main className="px-4 pt-2 pb-6">
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 py-2 text-sm text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Profile
      </Link>

      <header className="px-1 pt-4 pb-5">
        <p className="label-caps">Your Best Lifts</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          Personal Records
        </h1>
        <p className="mt-1.5 text-[13px] text-faint">
          Heaviest set in a finished workout — or, for exercises done without
          weight, the most reps in one set.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="surface rounded-2xl px-5 py-8 text-center text-sm leading-relaxed text-secondary">
          No records yet. Finish a workout and your best lifts will appear here.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h2 className="label-caps px-1 pb-2">{group.category}</h2>
              <ul className="surface overflow-hidden rounded-2xl">
                {group.records.map((r) => (
                  <li
                    key={r.exercise_name}
                    className="flex items-center gap-3 border-t border-hairline/60 px-5 py-3.5 first:border-t-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-primary">
                        {r.exercise_name}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-faint">
                        {formatLongDate(r.achieved_on)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-[15px] font-bold text-primary">
                        {r.kind === 'reps'
                          ? `${r.reps} reps`
                          : formatWeight(r.weight_kg, units.weight)}
                      </span>
                      {r.kind === 'weight' && r.reps != null && (
                        <span className="block text-[12px] text-secondary">
                          × {r.reps} reps
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
