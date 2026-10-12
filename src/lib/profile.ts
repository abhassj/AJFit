import 'server-only'

import { cache } from 'react'

import { getAuthUser, requireUser } from '@/lib/auth'
import {
  DEFAULT_UNITS,
  isHeightUnit,
  isWeightUnit,
  type HeightUnit,
  type Units,
  type WeightUnit,
} from '@/lib/units'

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  motto: string | null
  goal_bodyweight: number | null
  weight_unit: WeightUnit
  height_unit: HeightUnit
  /** Always centimetres; see src/lib/units.ts. */
  height_cm: number | null
  onboarded_at: string | null
}

export type ProfilePageData = {
  profile: Profile
  email: string
  bodyweight: { current: number | null; loggedOn: string | null }
}

/**
 * The user's profile. Nothing creates a profiles row at signup, so a missing
 * row is a normal state and is returned as an empty profile rather than an
 * error — the Profile page upserts on first save.
 *
 * Memoised per request: the app shell reads it for the avatar and Home reads it
 * again for the motto, and the Supabase client runs with cache: 'no-store', so
 * without this the same row would be fetched twice on every Home render.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getAuthUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_url, motto, goal_bodyweight, weight_unit, height_unit, height_cm, onboarded_at',
    )
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(`Failed to load profile: ${error.message}`)

  if (!data) {
    return {
      id: user.id,
      display_name: null,
      avatar_url: null,
      motto: null,
      goal_bodyweight: null,
      weight_unit: DEFAULT_UNITS.weight,
      height_unit: DEFAULT_UNITS.height,
      height_cm: null,
      onboarded_at: null,
    }
  }

  return {
    ...data,
    // The check constraints already guarantee these; the guards keep a bad
    // value from ever reaching arithmetic as an unknown unit.
    weight_unit: isWeightUnit(data.weight_unit)
      ? data.weight_unit
      : DEFAULT_UNITS.weight,
    height_unit: isHeightUnit(data.height_unit)
      ? data.height_unit
      : DEFAULT_UNITS.height,
  }
})

/**
 * The viewer's display units. Falls back to kg/cm when signed out or when the
 * profile cannot be read — units are presentation, and a failed lookup should
 * show metric rather than take a page down.
 */
export const getViewerUnits = cache(async (): Promise<Units> => {
  try {
    const profile = await getProfile()
    if (!profile) return DEFAULT_UNITS
    return { weight: profile.weight_unit, height: profile.height_unit }
  } catch {
    return DEFAULT_UNITS
  }
})

/** Everything the Profile page renders. */
export async function getProfilePageData(): Promise<ProfilePageData> {
  const { supabase, user } = await requireUser()

  const [profile, weight] = await Promise.all([
    getProfile(),
    supabase
      .from('weight_logs')
      .select('weight, log_date')
      // Latest day, then the latest entry (one per day since 20261013120000;
      // created_at settles any day logged before it).
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (weight.error) {
    throw new Error(`Failed to load bodyweight: ${weight.error.message}`)
  }

  return {
    profile: profile!,
    email: user.email ?? '',
    bodyweight: {
      current: weight.data?.weight ?? null,
      loggedOn: weight.data?.log_date ?? null,
    },
  }
}

/** The most recent bodyweight entry, kilograms; null when none is logged. */
export const getLatestBodyweightKg = cache(async (): Promise<number | null> => {
  const { supabase, user } = await getAuthUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('weight_logs')
    .select('weight')
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to load bodyweight: ${error.message}`)
  return data?.weight == null ? null : Number(data.weight)
})
