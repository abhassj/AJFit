'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'

export type ActionResult = { ok: true } | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

/**
 * Saves the identity fields. Upserts because no profiles row is created at
 * signup, so the first save has to create it.
 */
export async function saveProfileDetails(input: {
  display_name: string
  motto: string
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: input.display_name.trim() || null,
      motto: input.motto.trim() || null,
    },
    { onConflict: 'id' },
  )

  if (error) return fail(`Could not save your profile: ${error.message}`)

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Records the avatar's public URL after the browser has uploaded the file.
 *
 * The upload itself happens client-side straight to Storage so the image never
 * round-trips through the server; this only persists the resulting URL.
 */
export async function saveAvatarUrl(avatarUrl: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser()

  // Only ever accept a URL inside this user's own avatars folder.
  if (avatarUrl && !avatarUrl.includes(`/avatars/${user.id}/`)) {
    return fail('That avatar path is not yours.')
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, avatar_url: avatarUrl || null },
      { onConflict: 'id' },
    )

  if (error) return fail(`Could not save your avatar: ${error.message}`)

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return { ok: true }
}
