/**
 * Body mass index, with WHO adult bands and deliberately neutral copy
 * (decision D13).
 *
 * Always computed in metric from stored values — the latest bodyweight entry
 * (kg) and height (cm) — whatever units the user reads.
 *
 * The band is decided on the value rounded to one decimal, the same number
 * the user sees, so "25.0" can never be labelled with the band below it.
 */

export type BmiBand = 'under' | 'healthy' | 'over' | 'obese'

export type BmiResult = {
  /** Rounded to one decimal, as displayed. */
  value: number
  band: BmiBand
  label: string
  comment: string
}

/** Lower edge of each band, WHO adult classification. */
export const BMI_EDGES = { healthy: 18.5, over: 25, obese: 30 } as const

/** Fixed scale for the gauge: values outside it pin to the ends. */
export const BMI_SCALE = { min: 12, max: 42 } as const

const COPY: Record<BmiBand, { label: string; comment: string }> = {
  under: {
    label: 'Below the typical range',
    comment:
      'Below the usual adult range. If that’s unexpected, a doctor or dietitian can help check you’re fuelling your training well.',
  },
  healthy: {
    label: 'Within the typical range',
    comment: 'Within the usual adult range.',
  },
  over: {
    label: 'Above the typical range',
    comment:
      'Above the usual adult range. Plenty of people who lift sit here because of muscle — it’s one number among many.',
  },
  obese: {
    label: 'Well above the typical range',
    comment:
      'In the higher adult range. BMI is only a rough screen; a doctor can give you a fuller picture if you’d like one.',
  },
}

/** Shown with every result. */
export const BMI_NOTE =
  'BMI can’t tell muscle from fat, and these ranges are for adults.'

export function bmiBand(value: number): BmiBand {
  if (value < BMI_EDGES.healthy) return 'under'
  if (value < BMI_EDGES.over) return 'healthy'
  if (value < BMI_EDGES.obese) return 'over'
  return 'obese'
}

/** Null when either measurement is missing or implausible. */
export function computeBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): BmiResult | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const metres = heightCm / 100
  const value = Math.round((weightKg / (metres * metres)) * 10) / 10
  const band = bmiBand(value)
  return { value, band, ...COPY[band] }
}

/** 0–1 position of a BMI on the gauge's fixed scale. */
export function bmiGaugePosition(value: number): number {
  const t = (value - BMI_SCALE.min) / (BMI_SCALE.max - BMI_SCALE.min)
  return Math.min(1, Math.max(0, t))
}
