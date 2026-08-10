import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  goal_bodyweight: number | null
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
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, goal_bodyweight')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new Error(`Failed to load profile: ${error.message}`)

  return (
    data ?? {
      id: user.id,
      display_name: null,
      avatar_url: null,
      bio: null,
      goal_bodyweight: null,
    }
  )
}

/** Everything the Profile page renders. */
export async function getProfilePageData(): Promise<ProfilePageData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const [profile, weight] = await Promise.all([
    getProfile(),
    supabase
      .from('weight_logs')
      .select('weight, log_date')
      .order('log_date', { ascending: false })
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
