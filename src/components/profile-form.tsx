'use client'

import { useRef, useState, useTransition } from 'react'

import { logBodyweight, saveGoalBodyweight } from '@/app/(app)/actions'
import { saveAvatarUrl, saveProfileDetails } from '@/app/(app)/profile/actions'
import { Avatar } from '@/components/avatar'
import { ActionButton, Banner } from '@/components/ui'
import type { ProfilePageData } from '@/lib/profile'
import { createClient } from '@/lib/supabase/client'
import { parseBodyweight } from '@/lib/validation'

type Outcome = { ok: true } | { ok: false; error: string }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function ProfileForm({ data }: { data: ProfilePageData }) {
  const { profile, email, bodyweight } = data

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [motto, setMotto] = useState(profile.motto ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState(profile.goal_bodyweight?.toString() ?? '')
  const [weightError, setWeightError] = useState<string | null>(null)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  function run(
    fn: () => Promise<Outcome>,
    success: string,
    after?: () => void,
  ) {
    setMessage(null)
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        setMessage({ tone: 'success', text: success })
        after?.()
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  /**
   * Uploads straight from the browser to Storage, then persists the resulting
   * public URL. The file never passes through the Next server.
   */
  async function handleAvatar(file: File) {
    setMessage(null)

    if (!file.type.startsWith('image/')) {
      setMessage({ tone: 'error', text: 'Choose an image file.' })
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ tone: 'error', text: 'Images must be 5MB or smaller.' })
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')

      // Clear any previous avatar so changing file type never orphans a file.
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(user.id)
      if (existing?.length) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map((f) => `${user.id}/${f.name}`))
      }

      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw new Error(uploadError.message)

      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path)
        .data.publicUrl
      // Cache-bust so replacing the image is visible immediately.
      const versioned = `${publicUrl}?v=${Date.now()}`

      const result = await saveAvatarUrl(versioned)
      if (!result.ok) throw new Error(result.error)

      setAvatarUrl(versioned)
      setMessage({ tone: 'success', text: 'Profile picture updated.' })
    } catch (e) {
      setMessage({
        tone: 'error',
        text: e instanceof Error ? e.message : 'Upload failed.',
      })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const busy = pending || uploading

  return (
    <div className="space-y-3">
      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      {/* Identity */}
      <section className="surface rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <Avatar
            avatarUrl={avatarUrl}
            displayName={displayName || profile.display_name}
            email={email}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold text-primary">
              {displayName.trim() || 'Add your name'}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-secondary">
              {email}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="mt-2 text-[13px] font-semibold text-danger disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Change picture'}
            </button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleAvatar(file)
          }}
        />

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="label-caps">Display name</span>
            <input
              type="text"
              value={displayName}
              placeholder="e.g. AJ"
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-hairline bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint"
            />
          </label>

          <label className="block">
            <span className="label-caps">Motto</span>
            <input
              type="text"
              value={motto}
              maxLength={80}
              placeholder="e.g. Be brave with your life"
              onChange={(e) => setMotto(e.target.value)}
              className="mt-1.5 min-h-[46px] w-full rounded-xl border border-hairline bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint"
            />
            <span className="mt-1.5 block text-[12px] text-faint">
              A short line that shows on your Home screen. {80 - motto.length}{' '}
              characters left.
            </span>
          </label>

          <ActionButton
            tone="primary"
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(
                () => saveProfileDetails({ display_name: displayName, motto }),
                'Profile saved.',
              )
            }
          >
            {pending ? 'Saving…' : 'Save Profile'}
          </ActionButton>
        </div>
      </section>

      {/* Bodyweight — moved here from Home; this is now its only home. */}
      <section className="surface rounded-2xl p-5">
        <h2 className="label-caps">Bodyweight</h2>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[34px] leading-none font-bold text-primary tabular-nums">
              {bodyweight.current ?? '—'}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              {bodyweight.loggedOn
                ? `Logged ${bodyweight.loggedOn}`
                : 'No entries yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-bold text-secondary tabular-nums">
              {profile.goal_bodyweight ?? '—'}
            </p>
            <p className="mt-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              Goal
            </p>
          </div>
        </div>

        <GoalDelta
          current={bodyweight.current}
          goal={profile.goal_bodyweight}
        />

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="label-caps">Log today’s weight</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  placeholder="e.g. 78.5"
                  maxLength={6}
                  aria-invalid={weightError ? true : undefined}
                  aria-describedby={weightError ? 'weight-error' : undefined}
                  onChange={(e) => {
                    setWeight(e.target.value)
                    setWeightError(null)
                  }}
                  className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint ${
                    weightError
                      ? 'border-danger/70 ring-1 ring-danger/30'
                      : 'border-hairline'
                  }`}
                />
              </label>
              <ActionButton
                tone="primary"
                ariaLabel="Log today's weight"
                disabled={busy || weight.trim() === ''}
                className="shrink-0 px-5"
                onClick={() => {
                  /*
                   * This used to hand `Number(weight)` straight to the action.
                   * The action does reject a NaN, but only after a round trip,
                   * and it reported it in the page-level banner rather than
                   * against the field that caused it. Parsing here means the
                   * message appears where the user is looking; the action still
                   * re-checks, because it has to.
                   */
                  const parsed = parseBodyweight(weight)
                  if (!parsed.ok) {
                    setWeightError(parsed.error)
                    return
                  }
                  run(
                    () => logBodyweight(parsed.value),
                    'Weight logged.',
                    () => setWeight(''),
                  )
                }}
              >
                Add
              </ActionButton>
            </div>
            {weightError && (
              <span
                id="weight-error"
                role="alert"
                className="mt-1.5 block text-[12px] font-medium text-danger"
              >
                {weightError}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="label-caps">Goal weight</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={goal}
                  placeholder="e.g. 75"
                  maxLength={6}
                  aria-invalid={goalError ? true : undefined}
                  aria-describedby={goalError ? 'goal-error' : undefined}
                  onChange={(e) => {
                    setGoal(e.target.value)
                    setGoalError(null)
                  }}
                  className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint ${
                    goalError
                      ? 'border-danger/70 ring-1 ring-danger/30'
                      : 'border-hairline'
                  }`}
                />
              </label>
              <ActionButton
                ariaLabel="Save goal weight"
                disabled={busy}
                className="shrink-0 px-5"
                onClick={() => {
                  // Blank is meaningful here — it clears the goal.
                  if (goal.trim() === '') {
                    setGoalError(null)
                    run(() => saveGoalBodyweight(null), 'Goal cleared.')
                    return
                  }
                  const parsed = parseBodyweight(goal)
                  if (!parsed.ok) {
                    setGoalError(parsed.error)
                    return
                  }
                  run(() => saveGoalBodyweight(parsed.value), 'Goal saved.')
                }}
              >
                Save
              </ActionButton>
            </div>
            {goalError && (
              <span
                id="goal-error"
                role="alert"
                className="mt-1.5 block text-[12px] font-medium text-danger"
              >
                {goalError}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function GoalDelta({
  current,
  goal,
}: {
  current: number | null
  goal: number | null
}) {
  if (current === null || goal === null) return null
  const delta = current - goal

  return (
    <p className="mt-2 text-[13px] text-secondary">
      {Math.abs(delta) < 0.05
        ? 'At your goal.'
        : `${Math.abs(delta).toFixed(1)} ${delta > 0 ? 'above' : 'below'} goal.`}
    </p>
  )
}
