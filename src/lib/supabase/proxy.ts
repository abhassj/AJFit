import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { getSupabaseEnv } from './env'

/** Routes reachable without an active session. */
const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/**
 * Refreshes the Supabase auth session on every request and writes any rotated
 * tokens back onto the response, then redirects signed-out visitors to
 * /sign-in.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
        // Responses that set auth cookies must never be cached.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        )
      },
    },
  })

  // Do not run code between createServerClient and getUser(). A simple mistake
  // here can make it very hard to debug random sign-outs.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  /*
   * "No user" and "could not ask" are not the same answer.
   *
   * getUser() returns a null user both when the session is genuinely invalid
   * and when the auth server could not be reached at all. Treating the second
   * case as a sign-out is how a thirty-second connectivity blip turns into
   * everyone being logged out mid-workout — and with the cookie clearing below,
   * logged out irrecoverably rather than just bounced.
   *
   * So a retryable fetch failure falls through untouched: cookies are left
   * alone and the request proceeds to the page, where requireUser() throws and
   * the error boundary offers a retry. Only an authoritative answer from
   * Supabase — an expired or revoked token — reaches the redirect.
   */
  const unreachable = error != null && isAuthRetryableFetchError(error)

  if (!user && !unreachable && !isPublicPath(request.nextUrl.pathname)) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    signInUrl.search = ''

    const redirectResponse = NextResponse.redirect(signInUrl)

    /*
     * Clear the auth cookies on the way out.
     *
     * When a refresh token has expired or been revoked, getUser() returns no
     * user but the stale sb-* cookies stay on the browser. Redirecting alone
     * leaves them in place, so every subsequent request re-attempts the same
     * doomed refresh — a measurable delay on each navigation, and on the
     * sign-in page itself the client can pick the dead session back up and
     * bounce the user around. Expiring them here makes the redirect final:
     * the user arrives signed out, not half signed in.
     */
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        redirectResponse.cookies.set(cookie.name, '', {
          maxAge: 0,
          path: '/',
        })
      }
    }

    return redirectResponse
  }

  // Return the original `response` object so the refreshed cookies survive.
  return response
}
