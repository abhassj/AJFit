/**
 * Catalog shapes and pure helpers.
 *
 * Deliberately free of any server-only import so Client Components can use
 * these without pulling `@/lib/supabase/server` (and `next/headers`) into the
 * browser bundle. The queries themselves live in `@/lib/catalog`.
 */

export type CatalogExercise = {
  id: string
  name: string
}

export type CatalogSubcategory = {
  id: string
  name: string
  sort_order: number
  target_muscle: string
  how_to_perform: string
  exercises: CatalogExercise[]
}

export type CatalogCategory = {
  id: string
  name: string
  sort_order: number
  subcategories: CatalogSubcategory[]
}

export type ExerciseDetail = {
  id: string
  name: string
  subcategory: {
    id: string
    name: string
    target_muscle: string
    how_to_perform: string
    category: { id: string; name: string }
    /** Sibling exercises — the interchangeable variations of this movement. */
    siblings: CatalogExercise[]
  }
}

/**
 * `target_muscle` is stored as a single comma-separated string
 * ("Rhomboids, Middle Trapezius, Mid-Lats"). The mockups render it as bullets.
 */
export function splitTargetMuscles(targetMuscle: string): string[] {
  return targetMuscle
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}
