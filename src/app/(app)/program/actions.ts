'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { getOrCreateProgram } from '@/lib/program'
import { DAY_LABELS, DAYS_OF_WEEK, type DraftDay } from '@/lib/program-types'
import {
  parseDayTitle,
  parseRestSeconds,
  parseSplitName,
} from '@/lib/validation'

export type SaveResult = { ok: true } | { ok: false; error: string }

/**
 * Persists the builder draft onto the user's existing program.
 *
 * Updates in place: the program row and its seven program_days rows keep their
 * ids, so reloading never produces a second program. Only program_exercises
 * churn — rows the draft dropped are deleted, rows carrying an id are updated,
 * and new rows are inserted.
 *
 * Everything is re-validated here even though the builder validates as you
 * type. A Server Action is an ordinary HTTP endpoint that anything can post to,
 * so the browser's checks are a convenience for the user and this pass is the
 * actual guarantee about what reaches the database.
 */
export async function saveProgram(
  name: string,
  days: DraftDay[],
): Promise<SaveResult> {
  const { supabase } = await requireUser()

  const parsedName = parseSplitName(name)
  if (!parsedName.ok) return { ok: false, error: parsedName.error }

  const program = await getOrCreateProgram()
  const dayIdByDow = new Map(program.days.map((d) => [d.day_of_week, d.id]))

  const submitted = new Set(days.map((d) => d.day_of_week))
  for (const dow of DAYS_OF_WEEK) {
    if (!submitted.has(dow)) {
      return { ok: false, error: `Draft is missing ${dow}.` }
    }
  }

  // Validate every day and every exercise up front, so a bad value on Saturday
  // is reported before Monday has already been written.
  for (const day of days) {
    const title = parseDayTitle(day.title)
    if (!title.ok) {
      return {
        ok: false,
        error: `${DAY_LABELS[day.day_of_week]}: ${title.error}`,
      }
    }
    for (const exercise of day.exercises) {
      if (!exercise.exercise_id) {
        return {
          ok: false,
          error: `${DAY_LABELS[day.day_of_week]} has an exercise with nothing selected.`,
        }
      }
      const rest = parseRestSeconds(
        exercise.rest_seconds === null ? '' : String(exercise.rest_seconds),
      )
      if (!rest.ok) {
        return {
          ok: false,
          error: `${DAY_LABELS[day.day_of_week]}: ${rest.error}`,
        }
      }
    }
  }

  /*
   * What the draft removes, worked out from the program as loaded. A rest day
   * keeps no exercises, so everything on one is a removal.
   *
   * Removing an exercise that has been logged is allowed: its log rows keep
   * their own snapshot of what was performed (exercise_id, order, prescribed
   * reps) and only lose the link back to the slot, which the database clears
   * (ON DELETE SET NULL, migration 20261012120000). Before that migration the
   * link was RESTRICT, and this action had to refuse such removals.
   */
  const keptIds = new Set(
    days.flatMap((day) =>
      day.is_rest_day ? [] : day.exercises.flatMap((e) => (e.id ? [e.id] : [])),
    ),
  )
  const staleIds = program.days.flatMap((day) =>
    day.exercises.filter((e) => !keptIds.has(e.id)).map((e) => e.id),
  )

  const { error: nameError } = await supabase
    .from('programs')
    .update({ name: parsedName.value })
    .eq('id', program.id)

  if (nameError) {
    return { ok: false, error: `Could not save the name: ${nameError.message}` }
  }

  const dayResults = await Promise.all(
    days.map(async (day) => {
      const dayId = dayIdByDow.get(day.day_of_week)
      if (!dayId)
        return { ok: false as const, error: `Unknown day ${day.day_of_week}.` }

      const { error: dayError } = await supabase
        .from('program_days')
        .update({
          title: day.title.trim() || null,
          is_rest_day: day.is_rest_day,
        })
        .eq('id', dayId)

      if (dayError) {
        return {
          ok: false as const,
          error: `Could not save ${day.day_of_week}: ${dayError.message}`,
        }
      }

      // A rest day carries no exercises; clearing them here is what makes the
      // toggle destructive-but-explicit rather than merely hiding rows.
      const exercises = day.is_rest_day ? [] : day.exercises

      const exerciseResults = await Promise.all(
        exercises.map(async (exercise, index) => {
          const payload = {
            program_day_id: dayId,
            exercise_id: exercise.exercise_id,
            prescribed_reps: exercise.prescribed_reps.trim() || null,
            exercise_order: index,
            rest_seconds: exercise.rest_seconds,
            custom_fields: exercise.custom_fields ?? {},
          }

          if (exercise.id) {
            const { error } = await supabase
              .from('program_exercises')
              .update(payload)
              .eq('id', exercise.id)
            if (error) {
              return {
                ok: false as const,
                error: `Could not update an exercise: ${error.message}`,
              }
            }
            return { ok: true as const, id: exercise.id }
          } else {
            const { data, error } = await supabase
              .from('program_exercises')
              .insert(payload)
              .select('id')
              .single()
            if (error || !data) {
              return {
                ok: false as const,
                error: `Could not add an exercise: ${error?.message ?? 'unknown error'}`,
              }
            }
            return { ok: true as const, id: data.id }
          }
        }),
      )

      const failedExercise = exerciseResults.find((r) => !r.ok)
      if (failedExercise) return failedExercise

      return {
        ok: true as const,
        ids: exerciseResults.map((r) => (r.ok ? r.id : '')).filter(Boolean),
      }
    }),
  )

  const failedDay = dayResults.find((r) => !r.ok)
  if (failedDay) return { ok: false, error: failedDay.error }

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('program_exercises')
      .delete()
      .in('id', staleIds)

    if (deleteError) {
      return {
        ok: false,
        error: `Could not remove deleted exercises: ${deleteError.message}`,
      }
    }
  }

  revalidatePath('/program')
  revalidatePath('/start')
  return { ok: true }
}
