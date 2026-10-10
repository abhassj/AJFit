/**
 * Runs every suite against the local Supabase stack and prints a per-suite
 * pass/total table.
 *
 *   npm test                 all suites
 *   npm test -- timezone     only suites whose name contains "timezone"
 *
 * Requires `npx supabase start`. Test accounts are created on the local stack
 * and deleted at the end of the run.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Suite } from './lib/harness'
import { deleteTestUsers } from './lib/local'

/** Run order: baseline suites first, then the v2 ones, as they were added. */
const ORDER = [
  'phase2',
  'partA',
  'partB',
  'partHome',
  'phase6',
  'update1',
  'catalog-rls',
  'partC',
  'partD',
  'timezone',
]

async function main() {
  const filter = process.argv[2]
  const dir = path.join(__dirname, 'suites')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a)
      const ib = ORDER.indexOf(b)
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b)
    })
    .filter((name) => !filter || name.includes(filter))

  const rows: { name: string; passed: number; total: number }[] = []
  const failures: string[] = []

  try {
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(dir, `${file}.ts`)).href)
      const s: Suite = mod.default
      const names = Object.keys(s.tests)
      let passed = 0
      let setupError: unknown = null

      try {
        await s.setup?.()
      } catch (e) {
        setupError = e
      }

      for (const name of names) {
        if (setupError) {
          failures.push(
            `${s.name} › ${name}: setup failed: ${String(setupError)}`,
          )
          continue
        }
        try {
          await s.tests[name]()
          passed++
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          failures.push(`${s.name} › ${name}: ${msg.split('\n')[0]}`)
        }
      }

      try {
        await s.teardown?.()
      } catch (e) {
        failures.push(`${s.name} › teardown: ${String(e)}`)
      }

      rows.push({ name: s.name, passed, total: names.length })
      process.stdout.write(
        `${passed === names.length ? 'PASS' : 'FAIL'}  ${s.name} ${passed}/${names.length}\n`,
      )
    }
  } finally {
    try {
      deleteTestUsers()
    } catch (e) {
      failures.push(`cleanup: ${String(e)}`)
    }
  }

  const width = Math.max(5, ...rows.map((r) => r.name.length))
  const passed = rows.reduce((n, r) => n + r.passed, 0)
  const total = rows.reduce((n, r) => n + r.total, 0)
  const line = `+-${'-'.repeat(width)}-+--------+`
  console.log(`\n${line}`)
  console.log(`| ${'Suite'.padEnd(width)} | Passed |`)
  console.log(line)
  for (const r of rows) {
    console.log(
      `| ${r.name.padEnd(width)} | ${`${r.passed}/${r.total}`.padStart(6)} |`,
    )
  }
  console.log(line)
  console.log(
    `| ${'TOTAL'.padEnd(width)} | ${`${passed}/${total}`.padStart(6)} |`,
  )
  console.log(line)

  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  ✗ ${f}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
