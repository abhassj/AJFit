import { CatalogBrowser } from '@/components/catalog-browser'
import { getCatalog } from '@/lib/catalog'

export const metadata = { title: 'Exercise Catalog · AJFit' }

export default async function WorkoutsPage() {
  const categories = await getCatalog()

  const totalExercises = categories.reduce(
    (n, c) => n + c.subcategories.reduce((m, s) => m + s.exercises.length, 0),
    0,
  )
  const totalGroups = categories.reduce((n, c) => n + c.subcategories.length, 0)

  return (
    <main className="px-4 pt-2">
      {/* Editorial masthead: left-aligned and typographic, unlike Programs'
          tool header with its edit control. */}
      <header className="px-1 pb-2">
        <p className="label-caps">Reference</p>
        <h1 className="mt-1.5 text-[30px] leading-none font-bold tracking-tight text-primary">
          Catalog
        </h1>
        <p className="mt-2 text-[13px] text-secondary">
          {categories.length} categories · {totalGroups} groups ·{' '}
          {totalExercises} exercises
        </p>
      </header>

      <CatalogBrowser categories={categories} />
    </main>
  )
}
