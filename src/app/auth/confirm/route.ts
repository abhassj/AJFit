import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * Handles the link Supabase emails on sign-up. Exchanges the token hash for a
 * session, then drops the user on the home page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      redirect(next)
    }
  }

  redirect('/sign-in?error=Could+not+verify+email+link')
}
