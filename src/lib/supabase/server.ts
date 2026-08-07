import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { getSupabaseEnv } from './env'

/**
 * Supabase client for use in Server Components, Server Actions and Route
 * Handlers. Must be created per request — never cached or shared.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    global: {
      /*
       * Next patches global fetch and dedupes identical GETs within a render.
       * Supabase queries go through fetch, so a read repeated after a write in
       * the same request would be served the stale pre-write response. Opt every
       * data request out of that cache — none of this is static content.
       */
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component, which cannot write cookies. Safe to
          // ignore: src/proxy.ts refreshes the session on every request.
        }
      },
    },
  })
}
