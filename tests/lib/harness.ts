/**
 * A deliberately tiny test harness.
 *
 * Each suite is a plain object of named async tests. The runner (tests/run.ts)
 * executes them in order and prints a per-suite pass/total table, which is the
 * report format the release checklist asks for. No framework, so a suite can be
 * read top to bottom without knowing any test runner's conventions.
 */

export type Test = () => Promise<void> | void

export type Suite = {
  name: string
  /** Runs once before the tests; throw to fail every test in the suite. */
  setup?: () => Promise<void> | void
  tests: Record<string, Test>
  teardown?: () => Promise<void> | void
}

export function suite(
  name: string,
  tests: Record<string, Test>,
  hooks: Pick<Suite, 'setup' | 'teardown'> = {},
): Suite {
  return { name, tests, ...hooks }
}
