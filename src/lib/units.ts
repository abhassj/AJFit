/**
 * Units of measure: storage is always metric, display follows the user.
 *
 * The database stores every weight in kilograms and every height in
 * centimetres, at full precision (decision D1). A user's kg/lbs and cm/ft
 * preference only changes what they type and what they read. Nothing stored is
 * ever converted when the preference flips, so switching back and forth cannot
 * accumulate rounding error in someone's history.
 *
 * Rounding happens only at display. That is what makes the round trip exact:
 * 135 lb is stored as 61.234969950 kg and displays as 135 lb again, rather than
 * as 134.9 because something rounded to 61.2 on the way in.
 *
 * Pure and dependency-free, so both server and client code can use it.
 */

export type WeightUnit = 'kg' | 'lbs'
export type HeightUnit = 'cm' | 'ft'

export type Units = { weight: WeightUnit; height: HeightUnit }

export const DEFAULT_UNITS: Units = { weight: 'kg', height: 'cm' }

/** Exact, by international definition. */
export const KG_PER_LB = 0.45359237
export const CM_PER_INCH = 2.54

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'kg' || value === 'lbs'
}

export function isHeightUnit(value: unknown): value is HeightUnit {
  return value === 'cm' || value === 'ft'
}

/** A value typed in `unit`, as kilograms. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

/** Kilograms, expressed in `unit`. Unrounded. */
export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

/**
 * Rounds for display: at most one decimal place, with a trailing ".0"
 * dropped, so 60 reads "60" and 22.5 reads "22.5".
 */
export function roundForDisplay(value: number): string {
  const rounded = Math.round(value * 10) / 10
  // -0 would print as "0" anyway, but normalise it so comparisons are clean.
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** A stored kilogram value as the number the user reads, e.g. "135". */
export function displayWeight(kg: number, unit: WeightUnit): string {
  return roundForDisplay(fromKg(kg, unit))
}

/** A stored kilogram value with its unit, e.g. "135 lbs"; empty for null. */
export function formatWeight(
  kg: number | null | undefined,
  unit: WeightUnit,
): string {
  if (kg == null) return ''
  return `${displayWeight(kg, unit)} ${unit}`
}

/**
 * A weight the user typed, in their unit, as kilograms for storage. Returns
 * null for blank input; callers validate range and shape first.
 */
export function parseWeightInput(raw: string, unit: WeightUnit): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? toKg(n, unit) : null
}

/** Feet and inches for a height in centimetres; inches rounded to whole. */
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalInches = Math.round(cm / CM_PER_INCH)
  return { ft: Math.floor(totalInches / 12), in: totalInches % 12 }
}

/** Centimetres for feet and inches. Unrounded. */
export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_INCH
}

/** A stored height for display, e.g. "180 cm" or "5′11″". */
export function formatHeight(
  cm: number | null | undefined,
  unit: HeightUnit,
): string {
  if (cm == null) return ''
  if (unit === 'cm') return `${Math.round(cm)} cm`
  const { ft, in: inches } = cmToFtIn(cm)
  return `${ft}′${inches}″`
}
