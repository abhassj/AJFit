import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type {
  CatalogCategory,
  CatalogExercise,
  ExerciseDetail,
} from '@/lib/catalog-types'

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name)

/**
 * Fetches the whole catalog in a single nested query. The dataset is small
 * (6 categories / 26 subcategories / 86 exercises), so it is cheaper to fetch
 * once and structure in memory than to paginate or lazy-load per category.
 *
 * Categories and subcategories are ordered by their `sort_order` column.
 * Exercises have no ordering column and are listed alphabetically.
 */
export async function getCatalog(): Promise<CatalogCategory[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('categories')
    .select(
      `
      id,
      name,
      sort_order,
      subcategories (
        id,
        name,
        sort_order,
        target_muscle,
        how_to_perform,
        exercises ( id, name )
      )
    `,
    )
    .order('sort_order')
    .order('sort_order', { referencedTable: 'subcategories' })

  if (error) {
    throw new Error(`Failed to load the exercise catalog: ${error.message}`)
  }

  const categories = (data ?? []) as CatalogCategory[]

  for (const category of categories) {
    for (const subcategory of category.subcategories) {
      subcategory.exercises.sort(byName)
    }
  }

  return categories
}

/**
 * Fetches one exercise together with the context it inherits from its parent
 * subcategory. target_muscle and how_to_perform are stored once per
 * subcategory, never per exercise.
 */
export async function getExercise(
  exerciseId: string,
): Promise<ExerciseDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('exercises')
    .select(
      `
      id,
      name,
      subcategories (
        id,
        name,
        target_muscle,
        how_to_perform,
        categories ( id, name ),
        exercises ( id, name )
      )
    `,
    )
    .eq('id', exerciseId)
    .maybeSingle()

  if (error) {
    // An invalid uuid is a bad URL, not a server fault — surface it as "missing".
    if (error.code === '22P02') return null
    throw new Error(`Failed to load exercise: ${error.message}`)
  }

  if (!data) return null

  const row = data as unknown as {
    id: string
    name: string
    subcategories: {
      id: string
      name: string
      target_muscle: string
      how_to_perform: string
      categories: { id: string; name: string }
      exercises: CatalogExercise[]
    }
  }

  const sub = row.subcategories

  return {
    id: row.id,
    name: row.name,
    subcategory: {
      id: sub.id,
      name: sub.name,
      target_muscle: sub.target_muscle,
      how_to_perform: sub.how_to_perform,
      category: sub.categories,
      siblings: sub.exercises.filter((e) => e.id !== row.id).sort(byName),
    },
  }
}
