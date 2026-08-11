import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type Program,
  type ProgramDay,
  type ProgramExercise,
} from '@/lib/program-types'

const DEFAULT_PROGRAM_NAME = 'My Program'

type ProgramExerciseRow = {
  id: string
  exercise_id: string
  prescribed_reps: string | null
  exercise_order: number
  rest_seconds: number | null
  custom_fields: Record<string, string> | null
  exercises: {
    name: string
    subcategories: { name: string; categories: { name: string } }
  } | null
}

type ProgramDayRow = {
  id: string
  day_of_week: DayOfWeek
  title: string | null
  is_rest_day: boolean
  program_exercises: ProgramExerciseRow[]
}

function shapeExercise(row: ProgramExerciseRow): ProgramExercise {
  return {
    id: row.id,
    exercise_id: row.exercise_id,
    prescribed_reps: row.prescribed_reps,
    exercise_order: row.exercise_order,
    rest_seconds: row.rest_seconds,
    custom_fields: row.custom_fields ?? {},
    exercise_name: row.exercises?.name ?? 'Unknown exercise',
    subcategory_name: row.exercises?.subcategories?.name ?? '',
    category_name: row.exercises?.subcategories?.categories?.name ?? '',
  }
}

const PROGRAM_SELECT = `
  id,
  name,
  program_days (
    id,
    day_of_week,
    title,
    is_rest_day,
    program_exercises (
      id,
      exercise_id,
      prescribed_reps,
      exercise_order,
      rest_seconds,
      custom_fields,
      exercises (
        name,
        subcategories ( name, categories ( name ) )
      )
    )
  )
`

function shapeProgram(row: {
  id: string
  name: string
  program_days: ProgramDayRow[]
}): Program {
  const byDay = new Map<DayOfWeek, ProgramDayRow>()
  for (const day of row.program_days) byDay.set(day.day_of_week, day)

  const days: ProgramDay[] = DAYS_OF_WEEK.map((dow) => {
    const day = byDay.get(dow)
    return {
      id: day?.id ?? '',
      day_of_week: dow,
      title: day?.title ?? null,
      is_rest_day: day?.is_rest_day ?? false,
      exercises: (day?.program_exercises ?? [])
        .map(shapeExercise)
        .sort((a, b) => a.exercise_order - b.exercise_order),
    }
  })

  return { id: row.id, name: row.name, days }
}

/**
 * Loads the user's single living program, creating it (with all seven days) on
 * first visit. There is deliberately no versioning — the template is edited in
 * place and history lives in the sessions log instead (PRD §8.3).
 */
export async function getOrCreateProgram(): Promise<Program> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: existing, error: readError } = await supabase
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (readError) {
    throw new Error(`Failed to load program: ${readError.message}`)
  }

  /**
   * Adds any day rows the program is missing and returns their ids.
   *
   * Deliberately returns the inserted rows rather than re-reading the program:
   * re-reading after a write inside one render is what previously produced a
   * create/read loop, and it is unnecessary work either way.
   */
  async function createDays(programId: string, days: DayOfWeek[]) {
    if (days.length === 0) return new Map<DayOfWeek, string>()

    const { data, error } = await supabase
      .from('program_days')
      .insert(
        days.map((dow) => ({
          program_id: programId,
          day_of_week: dow,
          is_rest_day: false,
        })),
      )
      .select('id, day_of_week')

    if (error || !data) {
      throw new Error(
        `Failed to create program days: ${error?.message ?? 'unknown error'}`,
      )
    }

    return new Map(
      data.map((row) => [row.day_of_week as DayOfWeek, row.id as string]),
    )
  }

  if (existing) {
    const program = shapeProgram(
      existing as unknown as Parameters<typeof shapeProgram>[0],
    )
    // Heal a program that predates a day row, so the builder always has seven.
    const missing = program.days.filter((d) => !d.id).map((d) => d.day_of_week)
    if (missing.length === 0) return program

    const created = await createDays(program.id, missing)
    return {
      ...program,
      days: program.days.map((day) =>
        day.id ? day : { ...day, id: created.get(day.day_of_week) ?? '' },
      ),
    }
  }

  const { data: createdProgram, error: createError } = await supabase
    .from('programs')
    .insert({ user_id: user.id, name: DEFAULT_PROGRAM_NAME })
    .select('id, name')
    .single()

  if (createError || !createdProgram) {
    throw new Error(
      `Failed to create program: ${createError?.message ?? 'unknown error'}`,
    )
  }

  const dayIds = await createDays(createdProgram.id, [...DAYS_OF_WEEK])

  return {
    id: createdProgram.id,
    name: createdProgram.name,
    days: DAYS_OF_WEEK.map((dow) => ({
      id: dayIds.get(dow) ?? '',
      day_of_week: dow,
      title: null,
      is_rest_day: false,
      exercises: [],
    })),
  }
}

/** Loads a single day of the user's program, used by the Start Workout page. */
export async function getProgramDay(
  dayOfWeek: DayOfWeek,
): Promise<{ program: Program; day: ProgramDay }> {
  const program = await getOrCreateProgram()
  const day = program.days.find((d) => d.day_of_week === dayOfWeek)
  if (!day) throw new Error(`Program is missing ${dayOfWeek}`)
  return { program, day }
}
