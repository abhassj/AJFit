import 'server-only'

import { redirect } from 'next/navigation'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

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
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

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
