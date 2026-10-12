# Ezlyfts — Handoff Summary

**Last updated:** October 12, 2026 (end of V2)
**Replaces:** the old "AJFit Project Handoff Summary", which was never committed to the repo.

Read this first. It covers what the app is, how it is built and deployed, how
to test it, and the operational rules that matter. Details live in:

- `docs/AJFit_PRD_v1.md` — requirements and the live data model (v2.0)
- `docs/AJFit_Design_Language.md` — visual rules and component patterns (v2.0)
- `docs/AJFit_Implementation_Plan.md` — build history, phase by phase (v2.0)
- `docs/V2_Implementation_Plan.md` — the V2 plan and decisions D1–D14

The `AJFit_*` file names are kept so existing references keep working.

---

## 1. The app

**Ezlyfts** (formerly AJFit) is a mobile-first web app, installable as a PWA,
for planning a weekly gym split and logging workouts mid-session. It replaced a
Google Sheets workflow and is used by the owner and a few friends.

| Tab      | Route                         | What it does                                                                  |
| -------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Home     | `/`                           | Weekly bar (status colours, workout initials), month calendar, workout totals |
| Workouts | `/workouts`, `/workouts/[id]` | Read-only exercise catalog: 6 categories → 26 subcategories → 98 exercises    |
| Split    | `/program`                    | "My Workout Split": the Mon–Sun template builder                              |
| Start    | `/start`                      | Start / skip today, the live logger, the session summary                      |
| —        | `/history/[date]`             | A day: read-only detail, then the editor (`?edit=1`), or the backfill flow    |
| —        | `/profile`, `/profile/prs`    | Identity, units, height, bodyweight, BMI, personal records                    |
| —        | `/onboarding`                 | First stop for a new account after confirming its email                       |

## 2. Stack

Next.js 16 (App Router, `proxy.ts`, `unstable_retry` error boundaries) · React
19 · TypeScript · Tailwind v4 · Framer Motion (`LazyMotion` + `m`) · Supabase
(Postgres, Auth, Storage) via `@supabase/ssr` · Node 22+. No client data
library: pages read on the server; writes are Server Actions.

Hosting: **Vercel**, functions pinned to **`bom1`** (`vercel.json`), next to the
Supabase project in **`ap-south-1`** (Mumbai). Repo:
`github.com/abhassj/AJFit`. Domain: `aj-fit.vercel.app`. (Repo, domain, package
and database names were deliberately not renamed — decision D12.)

## 3. Deploys and the database — the rules

1. **A push to `main` deploys the app (Vercel) and applies new migrations to
   the live database (Supabase GitHub integration).** There is no staging step.
   Friends use the live app.
2. **Push only on the owner's explicit "push <commit>".** VS Code's one-click
   sync is disabled for this repo (`.vscode/settings.json`). It was the cause of
   three unintended production pushes in October 2026.
3. **Migrations are one concern per file and must be safe while the previous
   build is still serving**: additive, backfilled, no breaking drops. Test them
   locally first, and where the old build's writes matter, test those writes
   exactly (see `tests/suites/v2-batchb-migration.ts`).
4. After a push, check the commit's Vercel and Supabase checks (GitHub commit
   status) and the Supabase migration history.
5. Never hold or use the `service_role` key. No secrets in client code or the
   repo; `.env.local` holds only the URL and the publishable anon key.

Migrations, in order:

| File                                             | Concern                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `20260805224706_phase1_schema`                   | Tables, RLS, catalog seed                                                                                                                |
| `20260806204939_catalog_sort_order`              | Catalog display order                                                                                                                    |
| `20260810201328_profile_fields_and_avatars`      | Name, avatar, bio, avatars bucket                                                                                                        |
| `20260811202318_motto_rest_seconds_pushups`      | Motto, rest timer column, Push-Ups                                                                                                       |
| `20260814201343_catalog_read_only`               | Catalog SELECT-only                                                                                                                      |
| `20260814204500_revoke_latent_privileges`        | No anon grants, no TRUNCATE                                                                                                              |
| `20261010120000_v2_units_exercise_snapshot_prs`  | Units, height, onboarding marker, exercise snapshot, `exercise_prs()`                                                                    |
| `20261010120100_v2_unilateral_arms`              | Eleven single-arm Arms exercises                                                                                                         |
| `20261012120000_v2_history_independent_of_split` | Slot link SET NULL, order/reps snapshot, slot-ownership RLS, catalog REFERENCES/TRIGGER revoked                                          |
| `20261013120000_weight_logs_one_per_day`         | One bodyweight entry per user per day (unique + replace-trigger), `created_at`, duplicates moved to the owner-only `weight_logs_archive` |

## 4. How the important parts work

- **Today** is always the viewer's date: the browser writes its IANA zone to the
  `ajfit-tz` cookie (`TimezoneSync`), the server validates it
  (`src/lib/timezone.ts`, `viewer-time.ts`). Never use the server clock or a
  bare `new Date()` for dates.
- **Units** (`src/lib/units.ts`): stored kg/cm at full precision; converted only
  for input and display. `UnitsProvider` (client) and `getViewerUnits()`
  (server) supply the preference.
- **Live logger** (`session-runner.tsx`, `use-write-queue.ts`,
  `session-write-types.ts`): taps update client state immediately and queue a
  plain-data write. The queue saves one write at a time, in order; a failure
  stops it and shows a pinned Retry. Writes are idempotent (client-generated set
  ids, absolute pause totals), mirrored to sessionStorage, and replayed after a
  reload. When a deploy invalidates the page's Server Action ids, the queue
  stores, reloads once onto the new build and replays; if that fails too it
  stops with a visible alert instead of looping.
- **Auth**: `proxy.ts` refreshes sessions for page requests; Server Actions
  authenticate themselves (`requireUser` / `requireSession`). Every action is
  covered by an automated sign-out and cross-user sweep.
- **History**: each `session_exercises` row snapshots the exercise, order and
  prescription, so editing or removing a Split slot never rewrites a past log.
- **PRs**: one SQL function, `exercise_prs()` (SECURITY INVOKER).
- **Service worker** (`public/sw.js`): caches only hashed build output and the
  listed images; never pages, RSC or actions. Bump `CACHE` when shell art
  changes.

## 5. Testing

Everything runs against the **local** Supabase stack — never the live project.

```
npx supabase start                       # Docker Desktop must be running
npm test                                 # all suites (needs APP_URL for e2e-*)
npm test -- e2e-start                    # suites whose name contains "e2e-start"
```

Browser suites (`e2e-*`) need a production build pointed at the local stack,
served on :3100:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from `npx supabase status`> \
npm run build && npx next start -p 3100
APP_URL=http://localhost:3100 npm test
```

At the end of V2: 33 suites, all passing. They include the baseline regression
suites (rebuilt in V2), DB/RLS audits, the action-auth sweep, timezone tests
(Kolkata, London, Muscat) and phone-sized (414×896) browser flows.
`tests/perf/` holds the latency proxy and the Start-screen timing script used
for the Phase 1 measurements.

Gotchas: the C: drive runs close to full (Docker data is large), and a full disk
crashes Docker mid-pull. Playwright `evaluate` / `waitForFunction` should take
source strings or plain arrow functions (tsx injects a `__name` helper).

## 6. Owner's manual steps that remain

- Update the Supabase confirmation email template wording to "Ezlyfts"
  (Authentication → Email Templates).
- Tell iPhone users to delete and re-add the home-screen icon (iOS keeps the old
  name and icon from install time).
- Decide on database backups.
- If on Vercel Pro, enable Skew Protection (the app sets its own
  `deploymentId` otherwise).
- Replace the placeholder "Ez" icons with the real logo when it exists
  (`scripts/generate-icons.mjs`, then bump the SW cache).

## 7. Known limitations

- The first app icon/brand pass is a placeholder; the redesign is pending.
- Renaming a Split day changes the initials shown for past days that followed it.
- Logging needs a connection; nothing is queued offline beyond the current
  screen and a reload.
- Out of scope so far: offline logging, App Store / Play Store release,
  max-reps PRs for bodyweight work, left/right tagging on unilateral sets,
  ±15s rest adjustment.
