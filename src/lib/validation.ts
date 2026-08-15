/**
 * Input rules shared by the forms and the Server Actions behind them.
 *
 * Deliberately free of any server-only import: the same function has to run in
 * the browser, where it produces the inline message under a field, and again on
 * the server, where it is the actual guarantee. Client-side validation is a
 * courtesy — a Server Action is a public HTTP endpoint and anyone can post to
 * it directly, so nothing here may be trusted to have already run.
 *
 * Every validator returns `null` when the value is acceptable and a
 * ready-to-display sentence when it is not, so callers never assemble copy.
 */

/** Parsed result: `value` is what should reach the database. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value })
const bad = (error: string): Parsed<never> => ({ ok: false, error })

export const SPLIT_NAME_MAX = 60
export const DAY_TITLE_MAX = 60
export const REST_SECONDS_MIN = 5
export const REST_SECONDS_MAX = 3600
export const REPS_MAX = 999
export const WEIGHT_MAX = 2000
export const BODYWEIGHT_MIN = 20
export const BODYWEIGHT_MAX = 500

/**
 * Rejects strings that only look like numbers.
 *
 * `Number('')` is 0 and `Number(' ')` is 0, so a blank field parsed with the
 * bare constructor silently becomes a real zero in the database. Every numeric
 * path below goes through here instead.
 */
function toFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // Number() also accepts '0x10', '1e5' and 'Infinity'; none of those are
  // things anyone types into a reps box on purpose.
  if (!/^\d*\.?\d*$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** The name of the whole weekly split. Required — a split always has a name. */
export function parseSplitName(raw: string): Parsed<string> {
  const trimmed = raw.trim()
  if (trimmed === '') return bad('Give your split a name.')
  if (trimmed.length > SPLIT_NAME_MAX) {
    return bad(`Keep the name under ${SPLIT_NAME_MAX} characters.`)
  }
  return ok(trimmed)
}

/** A single day's title. Optional — an unnamed day falls back to its weekday. */
export function parseDayTitle(raw: string): Parsed<string | null> {
  const trimmed = raw.trim()
  if (trimmed === '') return ok(null)
  if (trimmed.length > DAY_TITLE_MAX) {
    return bad(`Keep the title under ${DAY_TITLE_MAX} characters.`)
  }
  return ok(trimmed)
}

/**
 * Rest period in seconds. Optional: blank means "no rest timer", which is a
 * real choice and persists as null rather than as zero.
 */
export function parseRestSeconds(raw: string): Parsed<number | null> {
  if (raw.trim() === '') return ok(null)
  const n = toFiniteNumber(raw)
  if (n === null) return bad('Rest must be a number of seconds.')
  if (!Number.isInteger(n)) return bad('Use whole seconds.')
  if (n < REST_SECONDS_MIN || n > REST_SECONDS_MAX) {
    return bad(
      `Rest must be between ${REST_SECONDS_MIN} and ${REST_SECONDS_MAX}s.`,
    )
  }
  return ok(n)
}

/** Reps for one set. Optional, but zero reps is not a set anyone performed. */
export function parseReps(raw: string): Parsed<number | null> {
  if (raw.trim() === '') return ok(null)
  const n = toFiniteNumber(raw)
  if (n === null) return bad('Reps must be a number.')
  if (!Number.isInteger(n)) return bad('Reps must be a whole number.')
  if (n < 1) return bad('Reps must be at least 1.')
  if (n > REPS_MAX) return bad(`Reps must be ${REPS_MAX} or fewer.`)
  return ok(n)
}

/**
 * Load for one set. Optional, and zero is legitimate — a bodyweight set is
 * genuinely zero added load, which is why this floor differs from reps.
 */
export function parseWeight(raw: string): Parsed<number | null> {
  if (raw.trim() === '') return ok(null)
  const n = toFiniteNumber(raw)
  if (n === null) return bad('Weight must be a number.')
  if (n < 0) return bad('Weight cannot be negative.')
  if (n > WEIGHT_MAX) return bad(`Weight must be ${WEIGHT_MAX} or less.`)
  return ok(n)
}

/** Bodyweight and goal bodyweight, in the unit the user already thinks in. */
export function parseBodyweight(raw: string): Parsed<number> {
  const n = toFiniteNumber(raw)
  if (n === null) return bad('Enter a weight.')
  if (n < BODYWEIGHT_MIN || n > BODYWEIGHT_MAX) {
    return bad(
      `Weight must be between ${BODYWEIGHT_MIN} and ${BODYWEIGHT_MAX}.`,
    )
  }
  return ok(n)
}

/**
 * A set needs at least one of the two figures. Logging a row where both are
 * blank records that something happened without recording what, which is worse
 * than not logging it — the set list would show "— reps × —" forever.
 */
export function validateSetEntry(
  repsRaw: string,
  weightRaw: string,
): { reps: number | null; weight: number | null; error: string | null } {
  const reps = parseReps(repsRaw)
  const weight = parseWeight(weightRaw)

  if (!reps.ok) return { reps: null, weight: null, error: reps.error }
  if (!weight.ok) return { reps: null, weight: null, error: weight.error }
  if (reps.value === null && weight.value === null) {
    return { reps: null, weight: null, error: 'Enter reps or weight first.' }
  }

  return { reps: reps.value, weight: weight.value, error: null }
}
