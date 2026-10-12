'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'

import { logBodyweight, saveGoalBodyweight } from '@/app/(app)/actions'
import {
  saveAvatarUrl,
  saveHeight,
  saveProfileDetails,
  saveUnits,
} from '@/app/(app)/profile/actions'
import { Avatar } from '@/components/avatar'
import { BmiRow } from '@/components/bmi-dialog'
import {
  HeightInput,
  heightDraft,
  parseHeightDraft,
} from '@/components/height-input'
import { ChevronRightIcon } from '@/components/icons'
import { Segmented } from '@/components/segmented'
import { ActionButton, Banner } from '@/components/ui'
import { useUnits } from '@/components/units-provider'
import type { ProfilePageData } from '@/lib/profile'
import { createClient } from '@/lib/supabase/client'
import {
  displayWeight,
  formatHeight,
  formatWeight,
  type HeightUnit,
  type WeightUnit,
} from '@/lib/units'
import { parseBodyweightIn } from '@/lib/validation'

type Outcome = { ok: true } | { ok: false; error: string }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function ProfileForm({ data }: { data: ProfilePageData }) {
  const { profile, email, bodyweight } = data
  // What the shell renders with; updated by saveUnits revalidating the layout.
  const units = useUnits()
  const unit = units.weight

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [motto, setMotto] = useState(profile.motto ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [weight, setWeight] = useState('')
  // Goal shown in the user's unit; stored in kilograms.
  const [goal, setGoal] = useState(
    profile.goal_bodyweight == null
      ? ''
      : displayWeight(profile.goal_bodyweight, unit),
  )
  const [height, setHeight] = useState(heightDraft(profile.height_cm))
  const [heightError, setHeightError] = useState<string | null>(null)
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

      {/* Units and height. Display only: nothing stored is converted (D1). */}
      <section className="surface rounded-2xl p-5">
        <h2 className="label-caps">Units</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] text-primary">Weight</span>
          <Segmented<WeightUnit>
            label="Weight unit"
            value={units.weight}
            disabled={busy}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lbs', label: 'lbs' },
            ]}
            onChange={(w) => {
              // The goal field holds a typed number; re-express it.
              if (profile.goal_bodyweight != null) {
                setGoal(displayWeight(profile.goal_bodyweight, w))
              }
              run(() => saveUnits(w, units.height), `Weights now in ${w}.`)
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] text-primary">Height</span>
          <Segmented<HeightUnit>
            label="Height unit"
            value={units.height}
            disabled={busy}
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'ft', label: 'ft' },
            ]}
            onChange={(h) =>
              run(
                () => saveUnits(units.weight, h),
                h === 'cm' ? 'Height now in cm.' : 'Height now in feet.',
              )
            }
          />
        </div>

        <div className="mt-4 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <HeightInput
              unit={units.height}
              draft={height}
              error={heightError}
              idPrefix="profile-height"
              onChange={(d) => {
                setHeight(d)
                setHeightError(null)
              }}
            />
          </div>
          <ActionButton
            ariaLabel="Save height"
            disabled={busy}
            className="shrink-0 px-5"
            onClick={() => {
              const parsed = parseHeightDraft(height, units.height)
              if (!parsed.ok) {
                setHeightError(parsed.error)
                return
              }
              run(
                () => saveHeight(parsed.value),
                `Height saved: ${formatHeight(parsed.value, units.height)}.`,
              )
            }}
          >
            Save
          </ActionButton>
        </div>
      </section>

      <BmiRow weightKg={bodyweight.current} heightCm={profile.height_cm} />

      <Link
        href="/profile/prs"
        className="surface flex min-h-[56px] items-center gap-3 rounded-2xl px-5 py-3"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-primary">
            Personal Records
          </span>
          <span className="block text-[13px] text-secondary">
            Your heaviest set for every lift
          </span>
        </span>
        <ChevronRightIcon className="h-4 w-4 text-faint" />
      </Link>

      {/* Bodyweight — moved here from Home; this is now its only home. */}
      <section className="surface rounded-2xl p-5">
        <h2 className="label-caps">Bodyweight</h2>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[34px] leading-none font-bold text-primary tabular-nums">
              {bodyweight.current == null
                ? '—'
                : formatWeight(bodyweight.current, unit)}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              {bodyweight.loggedOn
                ? `Logged ${bodyweight.loggedOn}`
                : 'No entries yet'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-bold text-secondary tabular-nums">
              {profile.goal_bodyweight == null
                ? '—'
                : formatWeight(profile.goal_bodyweight, unit)}
            </p>
            <p className="mt-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              Goal
            </p>
          </div>
        </div>

        <GoalDelta
          current={bodyweight.current}
          goal={profile.goal_bodyweight}
          unit={unit}
        />

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1">
                <span className="label-caps">Log today’s weight ({unit})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  placeholder={unit === 'kg' ? 'e.g. 78.5' : 'e.g. 172'}
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
                  // Typed in the user's unit; parsed to kilograms (D1).
                  const parsed = parseBodyweightIn(weight, unit)
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
                <span className="label-caps">Goal weight ({unit})</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={goal}
                  placeholder={unit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
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
                  const parsed = parseBodyweightIn(goal, unit)
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
  unit,
}: {
  current: number | null
  goal: number | null
  unit: WeightUnit
}) {
  if (current === null || goal === null) return null
  const delta = current - goal

  return (
    <p className="mt-2 text-[13px] text-secondary">
      {Math.abs(delta) < 0.05
        ? 'At your goal.'
        : `${formatWeight(Math.abs(delta), unit)} ${delta > 0 ? 'above' : 'below'} goal.`}
    </p>
  )
}
