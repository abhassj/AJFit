import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/sign-in'
    signInUrl.search = ''
    return NextResponse.redirect(signInUrl)
  }

  // Return the original `response` object so the refreshed cookies survive.
  return response
}
