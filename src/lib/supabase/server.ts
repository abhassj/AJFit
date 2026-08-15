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
       *
       * The deadline is the second thing here. A request to an upstream that
       * accepts the connection and then never answers — a gateway holding the
       * socket open for a backend that is down — has no timeout of its own, so
       * the render simply hangs and the user watches a blank tab until the
       * hosting platform gives up. Failing at ten seconds turns that into a
       * thrown error, which the error boundary catches and offers to retry.
       * Every query on these pages is a small indexed read; ten seconds is
       * already far beyond a healthy one.
       */
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: 'no-store',
          signal: init?.signal ?? AbortSignal.timeout(10_000),
        }),
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
