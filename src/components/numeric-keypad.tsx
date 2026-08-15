'use client'

/**
 * The design doc's numeric-entry pattern: two large tappable fields with the
 * active one outlined, and an in-app keypad below.
 *
 * The keypad is drawn rather than delegated to the OS keyboard on purpose —
 * this is used mid-set, one-handed, and a system keyboard both resizes the
 * viewport and puts the digits far from the thumb.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export type NumericField = 'reps' | 'weight'

export function NumericEntry({
  reps,
  weight,
  active,
  onActivate,
  onChange,
  label,
  error,
}: {
  reps: string
  weight: string
  active: NumericField
  onActivate: (field: NumericField) => void
  onChange: (field: NumericField, value: string) => void
  label: string
  /** Shown between the fields and the keypad, where the thumb already is. */
  error?: string | null
}) {
  function press(key: string) {
    const current = active === 'reps' ? reps : weight

    if (key === '⌫') {
      onChange(active, current.slice(0, -1))
      return
    }
    // Reps are whole numbers; only weight takes a decimal, and only one.
    if (key === '.') {
      if (active === 'reps' || current.includes('.')) return
      onChange(active, current === '' ? '0.' : `${current}.`)
      return
    }
    if (current.length >= 6) return
    onChange(active, current === '0' ? key : current + key)
  }

  return (
    <section className="surface rounded-2xl p-5">
      <h2 className="label-caps text-center">{label}</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <FieldButton
          label="Reps Done"
          value={reps}
          active={active === 'reps'}
          onClick={() => onActivate('reps')}
        />
        <FieldButton
          label="Weight"
          value={weight}
          active={active === 'weight'}
          onClick={() => onActivate('weight')}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-center text-[13px] font-medium text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === '⌫' ? 'Delete' : key}
            className="min-h-[54px] rounded-xl border border-hairline bg-card-raised text-xl font-semibold text-primary transition-colors active:bg-card-raised/60"
          >
            {key}
          </button>
        ))}
      </div>
    </section>
  )
}

function FieldButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}${value ? `, ${value}` : ', empty'}`}
      className="text-center"
    >
      <span className="label-caps">{label}</span>
      <span
        className={`mt-1.5 flex min-h-[62px] items-center justify-center rounded-xl border-2 text-3xl font-bold tabular-nums transition-colors ${
          active
            ? 'border-primary bg-card-raised text-primary shadow-[0_0_18px_-2px_rgb(246_249_254_/_0.35)]'
            : 'border-hairline bg-card-raised/60 text-secondary'
        }`}
      >
        {value || '—'}
      </span>
    </button>
  )
}
