'use client'

/**
 * Shared controls for the builder and session pages, so both stay on the same
 * tokens and touch-target sizes rather than each re-deriving them.
 *
 * Every interactive element here is at least 44px tall — these pages get used
 * one-handed, mid-set.
 */

import type { ReactNode } from 'react'

type ButtonTone = 'neutral' | 'danger' | 'primary'

const TONES: Record<ButtonTone, string> = {
  neutral:
    'bg-card-raised text-primary hover:bg-card-raised/70 border-hairline',
  primary: 'bg-primary text-base hover:bg-primary/90 border-transparent',
  danger: 'bg-danger text-white hover:bg-danger/90 border-transparent',
}

export function ActionButton({
  children,
  onClick,
  tone = 'neutral',
  disabled,
  type = 'button',
  className = '',
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: ButtonTone
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

/**
 * The design doc's triple-button action row: three equal-weight actions with
 * one visually distinct.
 */
export function TripleActionRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2.5">{children}</div>
}

/**
 * The inline message under an invalid field.
 *
 * `role="alert"` rather than a plain paragraph: validation messages appear
 * after the user has moved on from the field, so a screen reader needs to be
 * interrupted to hear about it. The red border on the control alone is not an
 * accessible signal — colour is never the only carrier of meaning here.
 */
function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <span
      id={id}
      role="alert"
      className="mt-1.5 block text-[12px] leading-snug font-medium text-danger"
    >
      {children}
    </span>
  )
}

/** Border and ring treatment shared by every invalid control. */
const INVALID_RING = 'border-danger/70 ring-1 ring-danger/30'

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string }[]
  placeholder: string
  disabled?: boolean
  error?: string | null
  id?: string
}) {
  const errorId = id ? `${id}-error` : undefined

  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <select
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary disabled:opacity-40 ${
          error ? INVALID_RING : 'border-hairline'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error && <FieldError id={errorId ?? ''}>{error}</FieldError>}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  error,
  id,
  maxLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal'
  error?: string | null
  id?: string
  maxLength?: number
}) {
  const errorId = id ? `${id}-error` : undefined

  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <input
        type="text"
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        // A hard cap on the input beats validating an over-long string after
        // the fact — the field simply stops accepting characters.
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 min-h-[46px] w-full rounded-xl border bg-card-raised px-3 text-[15px] text-primary placeholder:text-faint ${
          error ? INVALID_RING : 'border-hairline'
        }`}
      />
      {error && <FieldError id={errorId ?? ''}>{error}</FieldError>}
    </label>
  )
}

export function Banner({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  const styles =
    tone === 'error'
      ? 'border-danger/40 bg-danger/10 text-danger'
      : 'border-success/40 bg-success/10 text-success'

  return (
    <p
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}
    >
      {children}
    </p>
  )
}
