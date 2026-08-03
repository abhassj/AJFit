# AJ's Workout Tracker — Product Requirements Document (v1)

**Status:** Draft
**Version:** 1.0
**Last updated:** August 4, 2026
**Owner:** AJ

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
- Maintain a reusable exercise catalog with categories and informational alternates.
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

| Layer                             | Choice                                  | Rationale                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework                | **Next.js + React + TypeScript**        | AJ's existing expertise; best-in-class ecosystem for the spreadsheet-like grid the app depends on                                                                                         |
| Program builder grid              | **Glide Data Grid** (or TanStack Table) | Canvas/virtualized grid libraries purpose-built for spreadsheet-like performance, keyboard navigation, and large datasets — not achievable at the same quality in React Native            |
| Styling                           | **Tailwind CSS**                        | Fast to build with, consistent across web and future native shell                                                                                                                         |
| State & data fetching             | **TanStack Query + Zustand**            | Server cache/sync via React Query; lightweight local UI state via Zustand                                                                                                                 |
| Database                          | **Postgres via Supabase**               | Workout data is inherently relational (program → day → exercise → session → set); SQL makes trend queries, "last time" lookups, and future analytics straightforward                      |
| Auth                              | **Supabase Auth**                       | Bundled with the database service, minimal extra setup                                                                                                                                    |
| Offline-first sync (native phase) | **PowerSync or ElectricSQL**            | Brings Firebase-style local-first offline reliability to Postgres, needed once the app is used inside gyms with poor connectivity                                                         |
| Native app shell (future)         | **Capacitor**                           | Wraps the same Next.js/React codebase into real iOS/Android builds with native plugin access (haptics, local notifications for rest timers) — avoids a second UI codebase in React Native |
| Web hosting                       | **Vercel**                              | Standard Next.js deployment target                                                                                                                                                        |
| Native build/release (future)     | **Capacitor + native store tooling**    | For eventual App Store / Play Store submission                                                                                                                                            |

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

### 6.2 Exercises Page

- A browsable list of all exercises stored in the database, organized by category (e.g. Chest, Back, Legs).
- Each exercise entry shows relevant info and a list of **alternate exercises** — informational only, surfaced automatically based on shared movement pattern (see §8, Design Decisions) rather than manually curated.

### 6.3 Programs Page

- The program builder — where AJ constructs his own weekly plan, mirroring the flexibility of the old Google Sheets setup.
- Structured around a **Monday–Sunday weekly template**.
- Full customizability in laying out exercises, order, and rep prescriptions.
- Exercises are added by pulling from the Exercises catalog (§6.2), which is organized by category.
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

| Column          | Type      | Notes                         |
| --------------- | --------- | ----------------------------- |
| id              | uuid (PK) | References Supabase auth user |
| goal_bodyweight | numeric   | Single target value           |
| created_at      | timestamp |                               |

**`weight_logs`**

| Column   | Type      | Notes                                  |
| -------- | --------- | -------------------------------------- |
| id       | uuid (PK) |                                        |
| user_id  | uuid (FK) |                                        |
| log_date | date      |                                        |
| weight   | numeric   | Current bodyweight = most recent entry |

**`categories`**

| Column | Type      | Notes                        |
| ------ | --------- | ---------------------------- |
| id     | uuid (PK) |                              |
| name   | string    | e.g. "Chest," "Back," "Legs" |

**`exercises`**

| Column           | Type      | Notes                                               |
| ---------------- | --------- | --------------------------------------------------- |
| id               | uuid (PK) |                                                     |
| category_id      | uuid (FK) |                                                     |
| name             | string    |                                                     |
| movement_pattern | string    | e.g. "horizontal push" — used to surface alternates |
| description      | text      |                                                     |

**`programs`**

| Column     | Type      | Notes |
| ---------- | --------- | ----- |
| id         | uuid (PK) |       |
| user_id    | uuid (FK) |       |
| name       | string    |       |
| created_at | timestamp |       |

**`program_days`**

| Column      | Type      | Notes              |
| ----------- | --------- | ------------------ |
| id          | uuid (PK) |                    |
| program_id  | uuid (FK) |                    |
| day_of_week | string    | Mon–Sun            |
| title       | string    | e.g. "Chest & Tri" |
| is_rest_day | boolean   |                    |

**`program_exercises`**

| Column          | Type      | Notes                                 |
| --------------- | --------- | ------------------------------------- |
| id              | uuid (PK) |                                       |
| program_day_id  | uuid (FK) |                                       |
| exercise_id     | uuid (FK) | References catalog                    |
| prescribed_reps | string    | e.g. "3x6-10"                         |
| exercise_order  | int       |                                       |
| custom_fields   | jsonb     | User-defined extra tracked attributes |

### 7.2 Log tables (dated, historical)

**`sessions`**

| Column          | Type                | Notes                                 |
| --------------- | ------------------- | ------------------------------------- |
| id              | uuid (PK)           |                                       |
| user_id         | uuid (FK)           |                                       |
| program_day_id  | uuid (FK, nullable) | Template this session was based on    |
| session_date    | date                |                                       |
| status          | enum                | `completed`, `skipped`, `in_progress` |
| start_time      | timestamp           |                                       |
| end_time        | timestamp           |                                       |
| paused_duration | interval            | Total time paused                     |

**`session_exercises`**

| Column              | Type      | Notes                                       |
| ------------------- | --------- | ------------------------------------------- |
| id                  | uuid (PK) |                                             |
| session_id          | uuid (FK) |                                             |
| program_exercise_id | uuid (FK) | Template exercise this instance is based on |
| status              | enum      | `pending`, `completed`, `skipped`           |
| completed_at        | timestamp |                                             |
| comment             | text      | Per-exercise, per-session free-text note    |

**`sets`**

| Column              | Type      | Notes                                 |
| ------------------- | --------- | ------------------------------------- |
| id                  | uuid (PK) |                                       |
| session_exercise_id | uuid (FK) |                                       |
| set_number          | int       |                                       |
| reps_done           | int       |                                       |
| weight              | numeric   |                                       |
| comment             | text      |                                       |
| custom_fields       | jsonb     | User-defined extra tracked attributes |

---

## 8. Key Design Decisions

A running log of the notable decisions made while scoping this PRD, and why:

1. **Template vs. session split.** A program's Monday is a reusable template; what actually happened on a specific Monday is a dated, logged instance. Without this split, calendar views, per-exercise timestamps, and skip tracking have nowhere clean to live.
2. **Exercise catalog vs. program-exercise instance.** The Exercises page needs a standalone, browsable library; the Programs page needs to attach program-specific data (rep ranges, order) to entries from that library. These are modeled as two separate tables.
3. **One living template, not versioned.** The program is edited in place rather than duplicated week-to-week (unlike the old spreadsheet tabs). Historical progress is captured through the `sessions`/`sets` log instead, which removes the need for manual week-to-week duplication.
4. **Explicit skip marking.** Both whole-session skips and individual-exercise skips are user-triggered actions (not inferred from absence of data), so intentional rest is distinguishable from "not logged yet."
5. **Alternates via movement pattern, not manual curation.** Since alternates are purely informational, they're surfaced automatically by matching `movement_pattern` rather than requiring AJ to hand-pair every exercise — more accurate than category alone (e.g. it won't suggest a chest fly as an "alternate" to a bench press) and zero ongoing maintenance.
6. **JSONB `custom_fields` on exercises and sets.** This is the mechanism that preserves spreadsheet-style flexibility — new tracked attributes (RPE, tempo, machine setting, etc.) can be added per exercise or per set without a schema migration.
7. **Bodyweight as a time series, not a single field.** A `weight_logs` table (rather than a single "current weight" column) means "current" is simply the latest entry, and a trend chart becomes possible with no extra modeling later.

---

## 9. Non-Functional Requirements

- **Mobile-first responsiveness.** The Start Workout flow in particular must be usable one-handed, with thumb-zone-friendly primary actions.
- **Performance.** The program builder grid must remain smooth with a full multi-week, multi-exercise dataset loaded.
- **Data integrity.** Session and set data, once logged, should not be silently lost — especially relevant once offline support is added in Phase 2.
- **Security.** All data access scoped per-user via Supabase Auth and row-level security policies.

---

## 10. Future Considerations (Post-v1)

- Native App Store / Play Store release via Capacitor
- Offline-first sync (PowerSync or ElectricSQL) for reliable in-gym logging without connectivity
- Progress analytics: volume trends, estimated 1-rep max, automatic PR detection
- Local notifications for rest timers
- Multi-user support beyond AJ's personal use

---

## 11. Open Questions

- Final choice between Glide Data Grid and TanStack Table for the program builder — needs a small prototype to confirm feel.
- UI library for the monthly calendar view on the Home page — build custom vs. adopt an existing calendar component.
- Exact visual treatment for the "unique" weekly summary and total-workouts stat (explicitly called out as wanting a distinct look, not a plain table/number).
