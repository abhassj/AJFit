/**
 * Reads the Supabase connection settings from the environment.
 *
 * Only the publishable/anon key is ever referenced here — the service_role key
 * must never enter this codebase.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
    )
  }

  return { url, anonKey }
}
