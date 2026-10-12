'use client'

import { cmToFtIn, type HeightUnit } from '@/lib/units'
import { parseHeightCm, parseHeightFtIn, type Parsed } from '@/lib/validation'

export type HeightDraft = { cm: string; ft: string; in: string }

/** A draft prefilled from a stored height, in both shapes. */
export function heightDraft(cm: number | null): HeightDraft {
  if (cm == null) return { cm: '', ft: '', in: '' }
  const { ft, in: inches } = cmToFtIn(cm)
  return { cm: String(Math.round(cm)), ft: String(ft), in: String(inches) }
}

/** The draft in the chosen unit, as centimetres. */
export function parseHeightDraft(
  draft: HeightDraft,
  unit: HeightUnit,
): Parsed<number> {
  return unit === 'cm'
    ? parseHeightCm(draft.cm)
    : parseHeightFtIn(draft.ft, draft.in)
}

const field =
  'mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint'

/**
 * Height in centimetres, or in feet and inches — whichever the user reads.
 * Whatever is typed is converted to centimetres before it is stored.
 */
export function HeightInput({
  unit,
  draft,
  onChange,
  error,
  idPrefix,
}: {
  unit: HeightUnit
  draft: HeightDraft
  onChange: (draft: HeightDraft) => void
  error?: string | null
  idPrefix: string
}) {
  const border = error
    ? 'border-danger/70 ring-1 ring-danger/30'
    : 'border-hairline'
  return (
    <div>
      {unit === 'cm' ? (
        <label className="block">
          <span className="label-caps">Height (cm)</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.cm}
            placeholder="e.g. 178"
            maxLength={5}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
            onChange={(e) => onChange({ ...draft, cm: e.target.value })}
            className={`${field} ${border}`}
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label-caps">Height (ft)</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.ft}
              placeholder="5"
              maxLength={1}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ ...draft, ft: e.target.value })}
              className={`${field} ${border}`}
            />
          </label>
          <label className="block">
            <span className="label-caps">(in)</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.in}
              placeholder="10"
              maxLength={4}
              aria-invalid={error ? true : undefined}
              onChange={(e) => onChange({ ...draft, in: e.target.value })}
              className={`${field} ${border}`}
            />
          </label>
        </div>
      )}
      {error && (
        <span
          id={`${idPrefix}-error`}
          role="alert"
          className="mt-1.5 block text-[12px] font-medium text-danger"
        >
          {error}
        </span>
      )}
    </div>
  )
}
