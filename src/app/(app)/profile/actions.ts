'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { isValidTimeZone, zonedDateKey } from '@/lib/timezone'
import { isHeightUnit, isWeightUnit } from '@/lib/units'
import { isPlausibleBodyweightKg, isPlausibleHeightCm } from '@/lib/validation'
import { getViewerTimeZone } from '@/lib/viewer-time'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/**
 * Saves the identity fields. Upserts because no profiles row is created at
 * signup, so the first save has to create it.
 */
export async function saveProfileDetails(input: {
  display_name: string
  motto: string
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: input.display_name.trim() || null,
      motto: input.motto.trim() || null,
    },
    { onConflict: 'id' },
  )

  if (error) return fail(`Could not save your profile: ${error.message}`)

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Records the avatar's public URL after the browser has uploaded the file.
 *
 * The upload itself happens client-side straight to Storage so the image never
 * round-trips through the server; this only persists the resulting URL.
 */
export async function saveAvatarUrl(avatarUrl: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()

  // Only ever accept a URL inside this user's own avatars folder.
  if (avatarUrl && !avatarUrl.includes(`/avatars/${user.id}/`)) {
    return fail('That avatar path is not yours.')
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, avatar_url: avatarUrl || null },
      { onConflict: 'id' },
    )

  if (error) return fail(`Could not save your avatar: ${error.message}`)

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Display preferences only: no stored weight or height is converted (D1). */
export async function saveUnits(
  weightUnit: string,
  heightUnit: string,
): Promise<ActionResult> {
  if (!isWeightUnit(weightUnit) || !isHeightUnit(heightUnit)) {
    return fail('Unknown unit.')
  }
  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, weight_unit: weightUnit, height_unit: heightUnit },
      { onConflict: 'id' },
    )

  if (error) return fail(`Could not save your units: ${error.message}`)

  // Every screen formats with these, so re-render the whole shell.
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Height in centimetres, whatever unit it was typed in. */
export async function saveHeight(heightCm: number): Promise<ActionResult> {
  if (!isPlausibleHeightCm(heightCm)) return fail('Enter a realistic height.')
  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, height_cm: heightCm }, { onConflict: 'id' })

  if (error) return fail(`Could not save your height: ${error.message}`)

  revalidatePath('/profile')
  return { ok: true }
}

const NAME_MAX = 60
const MOTTO_MAX = 120

/**
 * Finishes onboarding: the profile, today's bodyweight and the marker that
 * stops the prompt, in one go.
 *
 * "Today" is the viewer's date. The browser sends its zone name with the
 * form because the very first page after confirming an email may load before
 * TimezoneSync has written the cookie; the name is validated exactly as the
 * cookie is (src/lib/timezone.ts), so it can only move the date within the
 * ±14h range of real zones.
 *
 * The weight is written before the profile, so onboarded_at is never set for
 * a user whose entry did not save. Upsert, because the profile row may not
 * exist yet.
 */
export async function completeOnboarding(input: {
  displayName: string
  motto: string
  weightKg: number
  heightCm: number
  weightUnit: string
  heightUnit: string
  timeZone?: string
}): Promise<ActionResult> {
  const name = input.displayName.trim()
  const motto = input.motto.trim()
  if (!name) return fail('Add your name.')
  if (name.length > NAME_MAX)
    return fail(`Keep your name under ${NAME_MAX} characters.`)
  if (motto.length > MOTTO_MAX)
    return fail(`Keep the motto under ${MOTTO_MAX} characters.`)
  if (!isPlausibleBodyweightKg(input.weightKg))
    return fail('Enter a realistic weight.')
  if (!isPlausibleHeightCm(input.heightCm))
    return fail('Enter a realistic height.')
  if (!isWeightUnit(input.weightUnit) || !isHeightUnit(input.heightUnit)) {
    return fail('Unknown unit.')
  }

  const { supabase, user } = await requireUser()
  const zone = isValidTimeZone(input.timeZone ?? '')
    ? input.timeZone!
    : await getViewerTimeZone()

  // One entry per day: this replaces any entry already made today.
  const { error: weightError } = await supabase.from('weight_logs').upsert(
    {
      user_id: user.id,
      log_date: zonedDateKey(zone),
      weight: input.weightKg,
    },
    { onConflict: 'user_id,log_date' },
  )
  if (weightError)
    return fail(`Could not save your weight: ${weightError.message}`)

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: name,
      motto: motto || null,
      height_cm: input.heightCm,
      weight_unit: input.weightUnit,
      height_unit: input.heightUnit,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) return fail(`Could not save your profile: ${error.message}`)

  revalidatePath('/', 'layout')
  return { ok: true }
}
