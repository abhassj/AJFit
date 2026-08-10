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
      <header className="px-1 pb-6 text-center">
        <h1 className="text-[13px] font-bold tracking-[0.18em] text-primary uppercase">
          Exercise Catalog
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
