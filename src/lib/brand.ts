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
} as const

/** "Page · Ezlyfts", the format every page title uses. */
export function pageTitle(page: string): string {
  return `${page} · ${BRAND.name}`
}
