/**
 * Program shapes and pure helpers, free of server-only imports so Client
 * Components can use them. Queries and mutations live in `@/lib/program`.
 */

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

/** An exercise as placed inside a program day. */
export type ProgramExercise = {
  id: string
  exercise_id: string
  prescribed_reps: string | null
  exercise_order: number
  /** Null means no rest timer is offered for this exercise. */
  rest_seconds: number | null
  custom_fields: Record<string, string>
  /** Denormalised for display; resolved from the catalog. */
  exercise_name: string
  subcategory_name: string
  category_name: string
}

export type ProgramDay = {
  id: string
  day_of_week: DayOfWeek
  title: string | null
  is_rest_day: boolean
  exercises: ProgramExercise[]
}

export type Program = {
  id: string
  name: string
  days: ProgramDay[]
}

/**
 * What the builder sends back on save. Ids are absent for rows created in the
 * browser and present for rows that already exist, which is how the server
 * decides between insert and update.
 */
export type DraftExercise = {
  id?: string
  exercise_id: string
  prescribed_reps: string
  /** Null means the user left the rest timer blank, which is valid. */
  rest_seconds: number | null
  custom_fields: Record<string, string>
}

export type DraftDay = {
  day_of_week: DayOfWeek
  title: string
  is_rest_day: boolean
  exercises: DraftExercise[]
}

/*
 * Both helpers below read `now`'s LOCAL fields, so the answer they give is
 * only as correct as the timezone the passed Date carries.
 *
 * They used to default to `new Date()`. On the server that resolves in the host
 * timezone — UTC on Vercel — so every caller silently computed UTC's today
 * instead of the viewer's, and a user in Kolkata saw yesterday until 05:30
 * local. The defaults are deliberately gone: a caller now has to supply a Date
 * that has already been resolved into the viewer's zone, and forgetting is a
 * type error rather than a wrong date shipped to production.
 *
 * Server callers get that Date from getViewerNow() in src/lib/viewer-time.ts.
 */

/** `now`'s day_of_week, read from its local fields. */
export function todayDayOfWeek(now: Date): DayOfWeek {
  // getDay() is 0=Sunday; DAYS_OF_WEEK starts at Monday.
  return DAYS_OF_WEEK[(now.getDay() + 6) % 7]
}

/** `now`'s calendar date as YYYY-MM-DD, avoiding the UTC shift of toISOString. */
export function localDateKey(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
