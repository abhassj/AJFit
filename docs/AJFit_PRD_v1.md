# Ezlyfts (formerly AJFit / AJ's Workout Tracker) — Product Requirements Document

**Status:** Current — matches the shipped app as of V2
**Version:** 2.0
**Last updated:** October 12, 2026
**Owner:** AJ

> Sections 1–11 are the original v1 requirements, corrected in place where the
> shipped app differs (notably §5 and §7). **§12 records V2** and supersedes
> anything earlier where the two disagree. The file keeps its original name so
> existing references to it still resolve.

---

## Changelog

**v2.0** — Renamed to **Ezlyfts** (monogram "Ez"). Added units (kg/lbs, cm/ft), height, onboarding, BMI, personal records, a weekly lock on finished days, a one-button rest timer, read-only day detail, workout initials and status-colour rules; logged history no longer depends on the Split template. §5 corrected to the stack actually used; §7 updated to the live schema; new §12 for V2. "Programs" is shown to users as **My Workout Split** (tables keep `programs*`).

**v1.1** — Exercise catalog restructured from a flat category/exercise list into a 3-level hierarchy: Category → Subcategory → Exercise, sourced from AJ's Gym Exercise Library & Execution Guide. Target muscle and technique ("how to perform") info now lives once per subcategory rather than per exercise. The `movement_pattern`-based automatic alternates feature is dropped — sibling exercises within the same subcategory now serve that purpose structurally. Sections 3, 6.2, 6.3, 7.1, and 8 updated accordingly.

---

## 1. Overview

AJ's Workout Tracker is a web application (with a planned native mobile release) that replaces a long-running personal workflow of building and tracking gym programs in Google Sheets. The goal is to keep the two things that made spreadsheets sticky — total layout freedom and a fast, all-at-once view of the data — while fixing everything they're bad at: mobile logging, historical lookups, progress tracking, and reminders.

**Vision:** A tool with the customizability and ease of Google Sheets, purpose-built for workout programming and logging, with a genuinely good mobile experience for use mid-workout in the gym.

---

## 2. Background & Problem Statement

AJ has tracked workouts in Google Sheets for a long period, using a consistent format:

- A new sheet tab duplicated for every week of a program
- Workouts grouped by muscle group (e.g. "Chest & Tri," "Back & Bi")
- Per-exercise columns for prescribed reps, reps actually done, weight used, and free-text comments
- A dedicated rest-day row/banner
- Manual bodyweight tracking per week

This works, but has clear limitations:

- **Not mobile-friendly.** Spreadsheets on mobile mean tiny cells, cramped typing, and general friction mid-set.
- **No memory.** Nothing auto-surfaces "what did I lift last time," volume trends, or PRs — that all lives in a human's memory or manual tab-scrolling.
- **No structure to build on.** Every week is a fresh copy-paste; there's no real database underneath to power calendars, stats, or smart features.

Existing fitness apps solve some of this but overcorrect the other way — they're rigid, form-driven, and don't allow the kind of freeform customization a spreadsheet gives you.

**Goal of this project:** build a purpose-made tool that keeps spreadsheet-level flexibility for planning, but adds a real data layer underneath for a genuinely good mobile logging experience, history, and stats.

---

## 3. Goals

- Let AJ build a weekly workout program with full customizability, similar in spirit to the Google Sheets workflow.
- Provide a fast, thumb-friendly mobile logging experience for use during an actual gym session.
- Track workout history with real dates, so progress and consistency are visible over time (calendar view, stats).
- Maintain a reusable, hierarchically organized exercise catalog (Category → Subcategory → Exercise) with built-in technique guidance.
- Ship as a responsive web app first; architect so a native iOS/Android release (App Store / Play Store) is a build step later, not a rewrite.

### Non-Goals (v1)

- Social features, leaderboards, or multi-user sharing
- Advanced analytics (e1RM estimation, volume-load charts, PR auto-detection) — noted as a future enhancement
- Wearable device integration
- Nutrition or macro tracking
- Push notifications / native offline sync (targeted for the native app phase, not the initial web release)

---

## 4. Target User

**Primary user (v1):** AJ, personal use. The app is being designed around AJ's exact existing workflow and terminology.

**Future consideration:** the architecture (multi-tenant schema with `user_id` on all core tables, Supabase Auth) is designed so this could later support other users without a redesign, even though v1 ships as a single-user tool in practice.

---

## 5. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | **Next.js 16 (App Router) + React 19 + TypeScript**, Node 22+ | AJ's existing expertise; best-in-class ecosystem for the spreadsheet-like grid the app depends on |
| Program builder | **Custom form rows** (as built) | The grid-library spike was not needed: a Mon–Sun list of day rows with cascading selects proved faster to use on a phone than a spreadsheet grid. Glide Data Grid / TanStack Table were never adopted. |
| Styling | **Tailwind CSS v4** | Fast to build with, consistent across web and future native shell |
| State & data fetching | **React Server Components + Server Actions** (as built) | Pages read through server-side Supabase clients; mutations are Server Actions. The live workout keeps its own client state with an ordered write queue (§12). TanStack Query and Zustand were never adopted. |
| Motion | **Framer Motion** via `LazyMotion` + `m` | Transform/opacity only; reduced motion respected |
| Database | **Postgres via Supabase** | Workout data is inherently relational (program → day → exercise → session → set); SQL makes trend queries, "last time" lookups, and future analytics straightforward |
| Auth | **Supabase Auth** | Bundled with the database service, minimal extra setup |
| Offline-first sync (native phase) | **PowerSync or ElectricSQL** | Brings Firebase-style local-first offline reliability to Postgres, needed once the app is used inside gyms with poor connectivity |
| Native app shell (future) | **Capacitor** | Wraps the same Next.js/React codebase into real iOS/Android builds with native plugin access (haptics, local notifications for rest timers) — avoids a second UI codebase in React Native |
| Web hosting | **Vercel** (functions pinned to `bom1`, beside the `ap-south-1` database) | Standard Next.js deployment target |
| Native build/release (future) | **Capacitor + native store tooling** | For eventual App Store / Play Store submission |

### Rollout phasing

1. **Phase 1 (this PRD's scope):** Responsive web app, installable as a PWA, core four pages, Supabase backend.
2. **Phase 2:** Capacitor-wrapped native builds, offline-first sync layer (PowerSync/ElectricSQL), App Store / Play Store release.
3. **Phase 3 (future):** Advanced analytics, richer history views, possible multi-user support.

---

## 6. Core Pages & Features

### 6.1 Home Page

- **Weekly workout summary** — a table/grid-style view showing each day of the current week and whether it was completed, skipped, or is upcoming. Presented with a distinct, non-generic visual treatment rather than a plain list.
- **Monthly calendar view** — all completed (and skipped) workouts plotted on a calendar; clicking a specific date opens that day's logged session in detail.
- **Current bodyweight** — most recent entry from the bodyweight log.
- **Goal bodyweight** — a single target value set by the user.
- **Total workouts stat** — including a "last 30 days" figure, displayed with a distinct visual treatment (not a plain number).

### 6.2 Exercises Page — shown as "Workouts"

- A browsable exercise catalog organized as a 3-level hierarchy: **Category** (exactly 6 — Chest, Back, Shoulders, Legs, Arms, Abs & Core) → **Subcategory** (a movement grouping, e.g. "Incline Press Variations," "Vertical Pull Variations") → individual **exercise variations** (e.g. "Incline Dumbbell Press").
- Each subcategory displays its target muscle(s) and a technique ("how to perform") description once, shared across every exercise variation underneath it — matching how AJ's source exercise library is actually organized.
- Exercises within the same subcategory function as each other's natural alternates. This is structural, not a separate feature: browsing to "Incline Press Variations" simply shows all three variations together, with no automatic-matching logic needed (see §8, Design Decisions).

### 6.3 Programs Page — shown as "My Workout Split"

- The program builder — where AJ constructs his own weekly plan, mirroring the flexibility of the old Google Sheets setup.
- Structured around a **Monday–Sunday weekly template**.
- Full customizability in laying out exercises, order, and rep prescriptions.
- Exercises are added via a **3-level cascading selector**: Category → Subcategory (filtered by the chosen category) → Exercise (filtered by the chosen subcategory), pulling from the Exercises catalog (§6.2).
- **Rest days** can be marked on any day of the week, replacing that day's exercise list with a rest indicator.
- **Save** persists the program as a single living template — there is no versioning/duplication step (see §8).
- **Edit anytime** — an edit (pencil) icon puts the builder into edit mode so the existing program can be updated in place at any time.

### 6.4 Start Workout Page

- Tapping "Start Workout" prompts a confirmation and begins a session timer.
- The current day's program (pulled from the active template) is displayed for logging.
- Each exercise can be:
  - **Marked complete**, which stamps a completion timestamp (enabling per-exercise timing/pacing visibility)
  - **Skipped**, explicitly, via a per-exercise skip action
  - **Commented on**, with free-text notes attached to that specific logged instance (equivalent to the old spreadsheet's COMMENTS column, but tied to a real date)
- **Timer controls:** Pause / Resume, and a Finish action to close out the session.
- A day can also be marked **Skipped** at the whole-session level (not just per-exercise) via an explicit action — this creates a dated record with no logged sets, distinguishing "I intentionally skipped this" from "not logged yet."

---

## 7. Data Model

The schema is split into two halves: a **template** (the reusable weekly program) and a **log** (dated, historical records of what actually happened). This split is what makes the calendar view, timers, and skip-tracking possible — see §8 for rationale.

### 7.1 Template tables

**`profiles`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | References Supabase auth user. No row is created at signup; every write upserts. |
| goal_bodyweight | numeric | Single target value, **kilograms** |
| display_name | text | |
| avatar_url | text | Public URL in the `avatars` storage bucket |
| motto | text | Shown as the Home headline when set |
| weight_unit | text | `kg` \| `lbs`, default `kg` — display/input only (V2) |
| height_unit | text | `cm` \| `ft`, default `cm` — display/input only (V2) |
| height_cm | numeric | 50–272, nullable (V2) |
| onboarded_at | timestamptz | Null until onboarding is finished (V2) |
| created_at | timestamp | |

**`weight_logs`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| log_date | date | The viewer's calendar date, in their timezone |
| weight | numeric | **Kilograms.** Current bodyweight = most recent entry |

**`categories`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | string | Exactly 6 rows: Chest, Back, Shoulders, Legs, Arms, Abs & Core |
| sort_order | int | Display order |

**`subcategories`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| category_id | uuid (FK) | |
| name | string | e.g. "Incline Press Variations" |
| target_muscle | string | e.g. "Upper Chest (Clavicular Head), Anterior Deltoids" |
| how_to_perform | text | Technique description, shared by all exercises in this subcategory |
| sort_order | int | Display order within the category |

**`exercises`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| subcategory_id | uuid (FK) | |
| name | string | e.g. "Incline Dumbbell Press" |

**`programs`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| name | string | |
| created_at | timestamp | |

**`program_days`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| program_id | uuid (FK) | |
| day_of_week | string | Mon–Sun |
| title | string | e.g. "Chest & Tri" |
| is_rest_day | boolean | |

**`program_exercises`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| program_day_id | uuid (FK) | |
| exercise_id | uuid (FK) | References catalog |
| prescribed_reps | string | e.g. "3x6-10" |
| exercise_order | int | |
| rest_seconds | int | Rest timer length; **null means no timer**. New exercises default to 120 in the builder (V2) |
| custom_fields | jsonb | User-defined extra tracked attributes |

The catalog tables (`categories`, `subcategories`, `exercises`) are **read-only**
for signed-in users (SELECT only, in both policy and grants); anon has no access
to any table. Catalog: 6 categories, 26 subcategories, 98 exercises.

### 7.2 Log tables (dated, historical)

**`sessions`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| program_day_id | uuid (FK, nullable) | Template this session was based on |
| session_date | date | |
| status | enum | `completed`, `skipped`, `in_progress` |
| start_time | timestamp | |
| end_time | timestamp | |
| paused_duration | interval | Total time paused |

**`session_exercises`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| session_id | uuid (FK) | |
| program_exercise_id | uuid (FK, **nullable**) | Template slot this was logged from. **ON DELETE SET NULL** (V2): removing the slot from the Split unlinks the log instead of being refused |
| exercise_id | uuid (FK, not null) | **Snapshot** of the exercise performed (V2). History, PRs and names read this, never the slot |
| exercise_order | int | Snapshot of the slot's order (V2) |
| prescribed_reps | text | Snapshot of the slot's prescription (V2) |
| status | enum | `pending`, `completed`, `skipped` |
| completed_at | timestamp | |
| comment | text | Per-exercise, per-session free-text note |

**`sets`**

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| session_exercise_id | uuid (FK) | |
| set_number | int | |
| reps_done | int | |
| weight | numeric | **Kilograms**, full precision (display rounds) |
| comment | text | |
| custom_fields | jsonb | User-defined extra tracked attributes |

---

## 8. Key Design Decisions

A running log of the notable decisions made while scoping this PRD, and why:

1. **Template vs. session split.** A program's Monday is a reusable template; what actually happened on a specific Monday is a dated, logged instance. Without this split, calendar views, per-exercise timestamps, and skip tracking have nowhere clean to live.
2. **Exercise catalog vs. program-exercise instance.** The Exercises page needs a standalone, browsable library; the Programs page needs to attach program-specific data (rep ranges, order) to entries from that library. These are modeled as two separate tables.
3. **One living template, not versioned.** The program is edited in place rather than duplicated week-to-week (unlike the old spreadsheet tabs). Historical progress is captured through the `sessions`/`sets` log instead, which removes the need for manual week-to-week duplication.
4. **Explicit skip marking.** Both whole-session skips and individual-exercise skips are user-triggered actions (not inferred from absence of data), so intentional rest is distinguishable from "not logged yet."
5. **Exercise catalog is a 3-level hierarchy (Category → Subcategory → Exercise), and alternates come from that structure for free.** This replaces the earlier `movement_pattern`-based matching approach. Target muscle and "how to perform" info live once on the subcategory rather than being repeated on every exercise underneath it, since that's how AJ's source exercise library is actually organized, and it avoids duplicating the same paragraph across 3-4 sibling rows. Since alternates are purely informational, the exercises grouped in the same subcategory already serve that role directly — no separate lookup, matching logic, or maintenance required.
6. **JSONB `custom_fields` on exercises and sets.** This is the mechanism that preserves spreadsheet-style flexibility — new tracked attributes (RPE, tempo, machine setting, etc.) can be added per exercise or per set without a schema migration.
7. **Bodyweight as a time series, not a single field.** A `weight_logs` table (rather than a single "current weight" column) means "current" is simply the latest entry, and a trend chart becomes possible with no extra modeling later.

---

### 7.3 Functions and triggers (V2)

- **`exercise_prs(p_names text[] = null, p_exclude_session uuid = null)`** —
  personal records: heaviest weight in a set of a *completed* session; ties go
  to more reps, then the earliest date; null/zero weights excluded; keyed by
  exercise **name** (so a lift catalogued in two categories has one record,
  returned once per category). SECURITY INVOKER (RLS applies); EXECUTE granted
  to `authenticated` only.
- **`session_exercises_fill_exercise_id`** (BEFORE INSERT) — fills
  `exercise_id`, `exercise_order` and `prescribed_reps` from the slot when an
  insert omits them, which kept older app builds writing valid rows during
  deploys.
- RLS on `session_exercises` also requires that a row's slot, if any, belongs
  to the caller.

---

## 9. Non-Functional Requirements

- **Mobile-first responsiveness.** The Start Workout flow in particular must be usable one-handed, with thumb-zone-friendly primary actions.
- **Performance.** The program builder grid must remain smooth with a full multi-week, multi-exercise dataset loaded.
- **Data integrity.** Session and set data, once logged, should not be silently lost — especially relevant once offline support is added in Phase 2.
- **Security.** All data access scoped per-user via Supabase Auth and row-level security policies. Every Server Action authenticates itself (the proxy does not re-check Server Action requests); a test sweeps every action signed out and as another user.
- **Responsiveness (V2).** A tap on the live workout screen shows its result immediately; saves happen in the background, in order, with a visible retry when one fails. Measured: logging a set went from ~1.7s and 20 Supabase requests to ~2ms on screen and 1 request.
- **Timezones.** "Today" is always the viewer's date in their own timezone (cookie set by the browser, validated on the server), never the server's.

---

## 10. Future Considerations (Post-v1)

- Native App Store / Play Store release via Capacitor
- Offline-first sync (PowerSync or ElectricSQL) for reliable in-gym logging without connectivity
- Progress analytics: volume trends, estimated 1-rep max (automatic PR detection shipped in V2)
- Local notifications for rest timers
- ~~Multi-user support~~ — the app now serves several real accounts (friends); see §12
- Still out of scope after V2: the final logo/redesign, offline logging, store release, max-reps PRs for bodyweight exercises, left/right tagging on unilateral sets, ±15s rest adjustment

---

## 11. Open Questions

- ~~Grid library for the builder~~ — resolved: custom form rows, no grid library.
- ~~Calendar UI library~~ — resolved: custom month grid.
- ~~Weekly summary / stat treatment~~ — resolved: segmented week bar with workout initials; two-figure stat tiles.
- Backups for the live database (made costlier to lose by PR history).
- Vercel plan: Skew Protection needs Pro; the app sets its own `deploymentId` and recovers stale tabs either way.

---

## 12. V2 — Ezlyfts (shipped)

Full plan: `docs/V2_Implementation_Plan.md`. Decisions D1–D14 there were all
approved and implemented; the points below are what a reader of this PRD needs.

### Product
- **Name:** Ezlyfts, monogram "Ez" (placeholder icons until the real logo). All
  user-facing text takes the name from `src/lib/brand.ts`.
- **Units (D1, D2):** kg/lbs and cm/ft on the profile, applied everywhere a
  weight or height appears (logger, history, PR line and page, Home detail,
  Profile, onboarding). The database always stores kg and cm; switching units
  never converts stored data.
- **Onboarding (D9):** new accounts go sign-up → confirm email → `/onboarding`
  (name, optional motto, bodyweight, height) → Home. Older accounts get a
  prefilled prompt once per browser session until they finish it.
- **BMI (D13):** from the latest bodyweight and height, WHO adult bands, an
  animated reveal (instant under reduced motion), neutral copy and the note
  "BMI can't tell muscle from fat, and these ranges are for adults."
- **Personal records (D4, D5):** beside each exercise on Start ("PR 60 kg × 8"),
  a "New PR" badge on the set that beats it, and a `/profile/prs` page grouped
  by category.
- **Weekly lock (D6):** a Split day with a completed session in the viewer's
  Mon–Sun week shows "Done · Mon" and cannot be started again until Monday;
  skips never lock; editing from Home stays allowed.
- **Rest timer (D14):** one button — "Skip Rest" while counting, "Next Set" when
  done. New exercises default to 2 minutes (D10).
- **Finish guard (D8):** finishing with nothing completed asks "Finish anyway,
  or mark the day skipped?"
- **Home:** green = any finished session (even with skipped exercises); red =
  whole-day skip only; not logged = neutral; in-progress = its own neutral state;
  legend under the calendar. Weekly bar shows initials of the workout actually
  done (D7). Tapping a logged day opens a read-only detail; "Edit logged workout"
  opens the editor.
- **Split:** shown as "My Workout Split". Logged exercises can now be removed;
  their history keeps its own snapshot.
- **Workouts:** eleven single-arm Arms exercises added to the existing Arms
  subcategories (D11).

### Engineering
- **Start screen correctness:** the heading and the stored session both derive
  from the chosen program day (it used to show today's weekday's title).
- **Speed:** the live runner holds session state on the client, applies taps
  instantly, and saves through an ordered, idempotent write queue mirrored to
  sessionStorage. On a deploy mid-workout it stores unsaved writes, reloads onto
  the new build and replays them.
- **History independence (D3):** see §7.2 — logs snapshot what was performed.
