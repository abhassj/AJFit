import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * One getUser() per request, shared by everything that renders in it.
 *
 * getUser() is a network round trip to the auth server, and a single page
 * render used to make several: the layout, getProfile() and each data module
 * all asked independently. Measured on the Start screen that was 15 auth calls
 * per tap — each one a trip across the Pacific when the function and the
 * database sit in different regions. Memoising per request keeps exactly one.
 *
 * The client travels with it so every query in the request shares one
 * cookie-backed session.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { supabase, user, error }
})

/**
 * Resolves the signed-in user, or sends an expired session to /sign-in.
 *
 * Every data module used to `throw new Error('Not signed in')` here. That is
 * the right instinct in the wrong shape: a signed-out request is not a bug, it
 * is the ordinary end of a session, and throwing turned it into a crash. In
 * production the thrown message is replaced by a generic digest string, so what
 * a user actually saw when their refresh token expired overnight was an
 * anonymous "Something went wrong" with no way forward except guessing the URL.
 *
 * Redirecting instead means the expiry resolves itself: the user lands on
 * sign-in, signs in, and continues. src/proxy.ts already does this for page
 * navigations; this closes the same gap for Server Actions and for any read
 * that outlives the token.
 *
 * `redirect()` works by throwing a control-flow signal, so callers must let it
 * through — see `unstable_rethrow` at the top of the action catch blocks.
 */
export async function requireUser() {
  const { supabase, user, error } = await getAuthUser()

  /*
   * Same distinction the proxy makes, and it has to be made here too because
   * this is the layer that actually decides. A null user can mean the token
   * expired, or it can mean the auth server was unreachable — and those want
   * opposite responses. Redirecting on a network failure would sign someone out
   * for a dropped connection, which is both wrong and unrecoverable-looking.
   *
   * Throwing instead sends it to the error boundary, which offers a retry. That
   * is the honest report: we do not know whether you are signed in, try again.
   */
  if (error && isAuthRetryableFetchError(error)) {
    throw new Error('Could not reach the authentication server.')
  }

  if (!user) redirect('/sign-in')

  return { supabase, user }
}

/**
 * For Server Actions on the logging hot path, which only write rows the caller
 * already owns and never need to know who the caller is.
 *
 * requireUser() costs a round trip to the auth server before the write can
 * even start. Here that check is redundant: PostgREST verifies the JWT on the
 * write itself and RLS decides whether the row is the caller's, so a forged or
 * expired token is refused by the database either way. What remains is the
 * user-facing part — sending someone whose session is gone back to sign-in
 * instead of reporting a failed save — and that only needs the local session,
 * which getSession() reads from the cookie (refreshing it when it has expired,
 * which is the only case that touches the network).
 *
 * Do not use this where the action reads user.id or trusts the session's
 * contents for anything other than "is there one".
 */
export async function requireSession() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getSession()

  if (error && isAuthRetryableFetchError(error)) {
    throw new Error('Could not reach the authentication server.')
  }
  if (!data.session) redirect('/sign-in')

  return { supabase }
}
