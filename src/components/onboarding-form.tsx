'use client'

import { useState, useTransition } from 'react'

import { completeOnboarding } from '@/app/(app)/profile/actions'
import {
  HeightInput,
  heightDraft,
  parseHeightDraft,
} from '@/components/height-input'
import { Segmented } from '@/components/segmented'
import { ActionButton, Banner } from '@/components/ui'
import { displayWeight, type HeightUnit, type WeightUnit } from '@/lib/units'
import { parseBodyweightIn } from '@/lib/validation'

export type OnboardingInitial = {
  displayName: string | null
  motto: string | null
  /** Latest logged bodyweight, kilograms. */
  weightKg: number | null
  heightCm: number | null
  weightUnit: WeightUnit
  heightUnit: HeightUnit
}

const input =
  'mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint'

/** The browser's IANA zone, sent with the form; see completeOnboarding. */
function browserZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/**
 * Name, motto, bodyweight and height (decision D9: all but the motto
 * required), each with its unit picker. Used by the /onboarding page after
 * signup and by the prompt existing users see, prefilled with what they
 * already have.
 */
export function OnboardingForm({
  initial,
  onDone,
  secondary,
}: {
  initial: OnboardingInitial
  onDone: () => void
  /** A second action beside Save, e.g. "Later" in the prompt. */
  secondary?: React.ReactNode
}) {
  const [name, setName] = useState(initial.displayName ?? '')
  const [motto, setMotto] = useState(initial.motto ?? '')
  const [weightUnit, setWeightUnit] = useState(initial.weightUnit)
  const [heightUnit, setHeightUnit] = useState(initial.heightUnit)
  const [weightKg] = useState(initial.weightKg)
  const [weight, setWeight] = useState(
    initial.weightKg == null ? '' : displayWeight(initial.weightKg, weightUnit),
  )
  const [height, setHeight] = useState(heightDraft(initial.heightCm))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Add your name.'
    const w = parseBodyweightIn(weight, weightUnit)
    if (!w.ok) next.weight = w.error
    const h = parseHeightDraft(height, heightUnit)
    if (!h.ok) next.height = h.error
    setErrors(next)
    if (!w.ok || !h.ok || next.name) return

    setFailure(null)
    startTransition(async () => {
      const result = await completeOnboarding({
        displayName: name,
        motto,
        weightKg: w.value,
        heightCm: h.value,
        weightUnit,
        heightUnit,
        timeZone: browserZone(),
      })
      if (result.ok) onDone()
      else setFailure(result.error)
    })
  }

  return (
    <div className="space-y-4">
      {failure && <Banner tone="error">{failure}</Banner>}

      <label className="block">
        <span className="label-caps">Name</span>
        <input
          type="text"
          value={name}
          maxLength={60}
          autoComplete="name"
          placeholder="What should we call you?"
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
          className={`${input} ${errors.name ? 'border-danger/70' : 'border-hairline'}`}
        />
        {errors.name && (
          <span role="alert" className="mt-1.5 block text-[12px] text-danger">
            {errors.name}
          </span>
        )}
      </label>

      <label className="block">
        <span className="label-caps">Motto (optional)</span>
        <input
          type="text"
          value={motto}
          maxLength={120}
          placeholder="Something to keep you going"
          onChange={(e) => setMotto(e.target.value)}
          className={`${input} border-hairline`}
        />
      </label>

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="label-caps">Bodyweight</span>
          <Segmented<WeightUnit>
            label="Weight unit"
            value={weightUnit}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lbs', label: 'lbs' },
            ]}
            onChange={(u) => {
              setWeightUnit(u)
              // Re-express a prefilled, untouched value in the new unit.
              if (weightKg != null) setWeight(displayWeight(weightKg, u))
            }}
          />
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={weight}
          maxLength={6}
          aria-label={`Bodyweight (${weightUnit})`}
          placeholder={weightUnit === 'kg' ? 'e.g. 72.5' : 'e.g. 160'}
          aria-invalid={errors.weight ? true : undefined}
          onChange={(e) => setWeight(e.target.value)}
          className={`${input} ${errors.weight ? 'border-danger/70' : 'border-hairline'}`}
        />
        {errors.weight && (
          <span role="alert" className="mt-1.5 block text-[12px] text-danger">
            {errors.weight}
          </span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="label-caps">Height</span>
          <Segmented<HeightUnit>
            label="Height unit"
            value={heightUnit}
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'ft', label: 'ft' },
            ]}
            onChange={setHeightUnit}
          />
        </div>
        <div className="mt-1">
          <HeightInput
            unit={heightUnit}
            draft={height}
            onChange={setHeight}
            error={errors.height}
            idPrefix="onboarding-height"
          />
        </div>
      </div>

      <div className={`grid gap-2.5 ${secondary ? 'grid-cols-2' : ''}`}>
        {secondary}
        <ActionButton tone="primary" onClick={submit} disabled={pending}>
          {pending ? 'Saving…' : 'Save and continue'}
        </ActionButton>
      </div>
    </div>
  )
}
