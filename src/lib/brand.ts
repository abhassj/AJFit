/**
 * The product's name, in one place.
 *
 * AJFit is now Ezlyfts. Everything a user reads takes its name from here, so
 * the real logo and any later rename are a one-file change. Deliberately NOT
 * renamed: the domain, the GitHub repo, the npm package, database objects and
 * the `ajfit-*` cookie and cache keys — those are infrastructure, and changing
 * them would mean reworking Supabase redirect URLs and the deploy integration
 * for no user-visible gain (decision D12).
 */
export const BRAND = {
  name: 'Ezlyfts',
  shortName: 'Ezlyfts',
  monogram: 'Ez',
  /**
   * The hazard-sign tagline on the sign-in and sign-up pages. Swap the copy
   * here; the layout takes any lengths. Alternates kept for later:
   *
   *   'SERIOUS LIFTERS ONLY.'
   *     'Excuses are not a supported feature.'
   *   'WARNING: MAY CAUSE GAINS.'
   *     'Side effects include discipline and zero rest days off.'
   *   'NOT FOR THE CASUAL.'
   *     'Built for the ones who actually show up.'
   */
  tagline: {
    label: 'Caution',
    headline: 'NO EXCUSES BEYOND THIS POINT.',
    sub: 'Built for people who are dead serious about getting fit.',
  },
} as const

/** "Page · Ezlyfts", the format every page title uses. */
export function pageTitle(page: string): string {
  return `${page} · ${BRAND.name}`
}
