'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateProgram } from '@/lib/program'
import {
  DAY_LABELS,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type DraftDay,
} from '@/lib/program-types'

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

/**
 * Replaces one day with the contents of another.
 *
 * This is a replace, not a merge: the target's title, rest-day flag and entire
 * exercise list are overwritten by the source's. The caller confirms before
 * calling, since it is destructive.
 *
 * Copying goes through the database rather than the builder's draft so the copy
 * reflects what is actually saved on the source day, not unsaved edits sitting
 * in the form.
 */
export async function copyDay(
  fromDayOfWeek: DayOfWeek,
  toDayOfWeek: DayOfWeek,
): Promise<SaveResult> {
  if (fromDayOfWeek === toDayOfWeek) {
    return { ok: false, error: 'Pick a different day to copy from.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const program = await getOrCreateProgram()
  const source = program.days.find((d) => d.day_of_week === fromDayOfWeek)
  const target = program.days.find((d) => d.day_of_week === toDayOfWeek)

  if (!source || !target) return { ok: false, error: 'Unknown day.' }
  if (source.is_rest_day || source.exercises.length === 0) {
    return {
      ok: false,
      error: 'That day has no exercises to copy.',
    }
  }

  /*
   * Existing target rows may be referenced by logged sessions
   * (ON DELETE RESTRICT), so refuse up front and name them rather than failing
   * on a raw FK violation mid-copy — same guard as saveProgram.
   */
  const existingIds = target.exercises.map((e) => e.id)
  if (existingIds.length > 0) {
    const { data: logged, error: loggedError } = await supabase
      .from('session_exercises')
      .select('program_exercise_id')
      .in('program_exercise_id', existingIds)

    if (loggedError) {
      return {
        ok: false,
        error: `Could not check history: ${loggedError.message}`,
      }
    }
    if ((logged ?? []).length > 0) {
      return {
        ok: false,
        error: `${DAY_LABELS[toDayOfWeek]} has logged workout history and cannot be overwritten. Nothing was changed.`,
      }
    }

    const { error: clearError } = await supabase
      .from('program_exercises')
      .delete()
      .in('id', existingIds)
    if (clearError) {
      return {
        ok: false,
        error: `Could not clear the day: ${clearError.message}`,
      }
    }
  }

  const { error: dayError } = await supabase
    .from('program_days')
    .update({ title: source.title, is_rest_day: source.is_rest_day })
    .eq('id', target.id)
  if (dayError) {
    return { ok: false, error: `Could not update the day: ${dayError.message}` }
  }

  const { error: insertError } = await supabase
    .from('program_exercises')
    .insert(
      source.exercises.map((exercise, index) => ({
        program_day_id: target.id,
        exercise_id: exercise.exercise_id,
        prescribed_reps: exercise.prescribed_reps,
        exercise_order: index,
        rest_seconds: exercise.rest_seconds,
        custom_fields: exercise.custom_fields ?? {},
      })),
    )

  if (insertError) {
    return {
      ok: false,
      error: `Could not copy the exercises: ${insertError.message}`,
    }
  }

  revalidatePath('/program')
  revalidatePath('/start')
  return { ok: true }
}
