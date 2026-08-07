'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateProgram } from '@/lib/program'
import { DAYS_OF_WEEK, type DraftDay } from '@/lib/program-types'

export type SaveResult = { ok: true } | { ok: false; error: string }

/**
 * Persists the builder draft onto the user's existing program.
 *
 * Updates in place: the program row and its seven program_days rows keep their
 * ids, so reloading never produces a second program. Only program_exercises
 * churn — rows the draft dropped are deleted, rows carrying an id are updated,
 * and new rows are inserted.
 */
export async function saveProgram(days: DraftDay[]): Promise<SaveResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const program = await getOrCreateProgram()
  const dayIdByDow = new Map(program.days.map((d) => [d.day_of_week, d.id]))

  const submitted = new Set(days.map((d) => d.day_of_week))
  for (const dow of DAYS_OF_WEEK) {
    if (!submitted.has(dow)) {
      return { ok: false, error: `Draft is missing ${dow}.` }
    }
  }

  const keptExerciseIds: string[] = []

  for (const day of days) {
    const dayId = dayIdByDow.get(day.day_of_week)
    if (!dayId) return { ok: false, error: `Unknown day ${day.day_of_week}.` }

    const { error: dayError } = await supabase
      .from('program_days')
      .update({
        title: day.title.trim() || null,
        is_rest_day: day.is_rest_day,
      })
      .eq('id', dayId)

    if (dayError) {
      return {
        ok: false,
        error: `Could not save ${day.day_of_week}: ${dayError.message}`,
      }
    }

    // A rest day carries no exercises; clearing them here is what makes the
    // toggle destructive-but-explicit rather than merely hiding rows.
    const exercises = day.is_rest_day ? [] : day.exercises

    for (const [index, exercise] of exercises.entries()) {
      const payload = {
        program_day_id: dayId,
        exercise_id: exercise.exercise_id,
        prescribed_reps: exercise.prescribed_reps.trim() || null,
        exercise_order: index,
        custom_fields: exercise.custom_fields ?? {},
      }

      if (exercise.id) {
        const { error } = await supabase
          .from('program_exercises')
          .update(payload)
          .eq('id', exercise.id)
        if (error) {
          return {
            ok: false,
            error: `Could not update an exercise: ${error.message}`,
          }
        }
        keptExerciseIds.push(exercise.id)
      } else {
        const { data, error } = await supabase
          .from('program_exercises')
          .insert(payload)
          .select('id')
          .single()
        if (error || !data) {
          return {
            ok: false,
            error: `Could not add an exercise: ${error?.message ?? 'unknown error'}`,
          }
        }
        keptExerciseIds.push(data.id)
      }
    }
  }

  // Drop anything the draft removed. Scoped to this program's days so a bad
  // draft can never reach another user's rows (RLS would refuse anyway).
  const dayIds = [...dayIdByDow.values()]

  let staleQuery = supabase
    .from('program_exercises')
    .select('id, exercises ( name )')
    .in('program_day_id', dayIds)
  if (keptExerciseIds.length > 0) {
    staleQuery = staleQuery.not('id', 'in', `(${keptExerciseIds.join(',')})`)
  }

  const { data: stale, error: staleError } = await staleQuery
  if (staleError) {
    return {
      ok: false,
      error: `Could not reconcile the program: ${staleError.message}`,
    }
  }

  const staleIds = (stale ?? []).map((row) => row.id)
  if (staleIds.length > 0) {
    /*
     * session_exercises references program_exercises ON DELETE RESTRICT, so an
     * exercise that has already been logged cannot be removed from the
     * template without destroying that history. Detect it up front and name the
     * offenders, rather than letting the save fail on a raw FK violation.
     */
    const { data: logged, error: loggedError } = await supabase
      .from('session_exercises')
      .select('program_exercise_id')
      .in('program_exercise_id', staleIds)

    if (loggedError) {
      return {
        ok: false,
        error: `Could not check logged history: ${loggedError.message}`,
      }
    }

    const blockedIds = new Set((logged ?? []).map((r) => r.program_exercise_id))
    if (blockedIds.size > 0) {
      const names = (stale ?? [])
        .filter((row) => blockedIds.has(row.id))
        .map(
          (row) =>
            (row.exercises as unknown as { name: string } | null)?.name ??
            'an exercise',
        )
      const unique = [...new Set(names)]
      return {
        ok: false,
        error: `${unique.join(', ')} ${unique.length === 1 ? 'has' : 'have'} logged workout history and cannot be removed from the program. Everything else was left unchanged.`,
      }
    }

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
