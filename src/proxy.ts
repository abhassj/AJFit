import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files, which
     * never need a session refresh.
     *
     * The PWA entry points are excluded explicitly. The browser fetches
     * /manifest.webmanifest and /sw.js outside any page navigation, and for the
     * manifest often without credentials at all — so running them through the
     * session check redirected both to /sign-in. That is not a subtle failure:
     * a manifest that answers with an HTML sign-in page is not a manifest, so
     * the install prompt never appears, and a service worker served as
     * text/html is rejected outright for the wrong MIME type.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
