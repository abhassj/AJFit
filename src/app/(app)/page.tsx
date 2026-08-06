import { redirect } from 'next/navigation'

import { signOut } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'

/**
 * Phase 0's placeholder home page, relocated into the (app) shell so the bottom
 * navigation is reachable from the landing route. Behaviour is unchanged: it
 * redirects when signed out, shows the signed-in email, and signs out. The real
 * dashboard is Phase 5.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 p-6">
      <div>
        <p className="label-caps">AJFit</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary">
          Home
        </h1>
      </div>

      <p className="text-secondary">Signed in as {user.email}</p>

      <form action={signOut}>
        <button
          type="submit"
          className="surface rounded-xl px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-card-raised"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
