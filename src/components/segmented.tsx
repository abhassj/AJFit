'use client'

/**
 * A two-or-more option toggle (kg | lbs, cm | ft). A radiogroup, so screen
 * readers announce it as one choice and arrow keys move between options.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-xl border border-hairline bg-card-raised p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(o.value)}
            className={`min-h-[36px] min-w-[56px] rounded-lg px-3 text-[13px] font-bold tracking-wide uppercase transition-colors disabled:opacity-50 ${
              active
                ? 'bg-primary text-base'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
