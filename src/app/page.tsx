import { redirect } from 'next/navigation'

import { signOut } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">AJFit</h1>
      <p>Signed in as {user.email}</p>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-black/20 px-4 py-2 dark:border-white/30"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
