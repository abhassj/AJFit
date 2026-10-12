# Ezlyfts (formerly AJFit) — Implementation Plan

**Status:** Phases 0–6 and V2 shipped; Phases 7–8 open
**Version:** 2.0
**Last updated:** October 12, 2026
**Companion docs:** PRD v2.0 (`AJFit_PRD_v1.md`), Design Language v2.0, `V2_Implementation_Plan.md`, `Ezlyfts_Handoff_Summary.md`

---

## Changelog

**v2.0** — Status brought up to date: Phases 0–6 are built and live (checked off below, with the places the build differed from the plan noted inline). The V2 work (Ezlyfts) is summarised in the new "V2" section; its detailed plan is `docs/V2_Implementation_Plan.md`.

**v1.1** — Exercise catalog restructured from a flat `categories` + `exercises` (with a `movement_pattern` tag) into a 3-level hierarchy: `categories` → `subcategories` → `exercises`. Target muscle and technique ("how to perform") info now lives once per subcategory rather than per exercise. The automatic "alternates" feature is dropped — sibling exercises within the same subcategory now serve that purpose structurally, with no extra lookup logic needed. Phase 1, 2, and 3 task lists updated accordingly.

---

## How to use this document

Each phase below has a goal, a task checklist, and a **Definition of Done**. Don't start a phase until the previous one's Definition of Done is met — this keeps the build linear and avoids half-finished dependencies stacking up.

> **Note on phase numbering:** this document breaks the PRD's "Phase 1: Web App" into eight granular build phases (0–6 = core web app, 7 = mobile polish). The PRD's "Phase 2: Native Release" corresponds to Phase 7 here, and the PRD's "Phase 3: Future" corresponds to Phase 8.

---

## Phase overview

| Phase | Name | Depends on |
|---|---|---|
| 0 | Project Setup & Foundations | — |
| 1 | Database Schema & Seed Data | Phase 0 |
| 2 | Exercises Page | Phase 1 |
| 3 | Programs Page (Builder) | Phase 1, 2 |
| 4 | Start Workout / Session Logging | Phase 3 |
| 5 | Home Page | Phase 4 |
| 6 | Mobile Polish & PWA | Phase 2–5 |
| 7 | Native App Release | Phase 6 |
| 8 | Post-Launch Enhancements | Phase 7 |

---

## Phase 0 — Project Setup & Foundations

**Goal:** A deployed, authenticated skeleton with the full toolchain wired up, so every later phase is pure feature work.

- [x] Initialize Next.js (TypeScript) project, App Router
- [x] Install and configure Tailwind CSS
- [x] Set up ESLint / Prettier conventions
- [x] Create Supabase project (dev environment)
- [x] Wire Supabase client (browser + server) into Next.js
- [x] Set up environment variables (local `.env`, Vercel project settings)
- [x] Push repo to GitHub
- [x] Deploy a minimal build to Vercel to confirm the pipeline end-to-end
- [x] Basic Supabase Auth flow (sign in / sign out)

**Definition of Done:** A logged-in user lands on a blank authenticated shell, deployed and reachable on the web.

---

## Phase 1 — Database Schema & Seed Data

**Goal:** Every table exists in Supabase, secured, and the exercise catalog is fully seeded with a real 3-level hierarchy.

- [x] Write SQL migration for all core tables: `profiles`, `weight_logs`, `categories`, `subcategories`, `exercises`, `programs`, `program_days`, `program_exercises`, `sessions`, `session_exercises`, `sets`
- [x] `subcategories` carries `target_muscle` and `how_to_perform` (shared once across all exercises within it); `exercises` references `subcategory_id` only — no `movement_pattern` column
- [x] Add Row Level Security policies scoping every user-owned table to the authenticated user; `categories`, `subcategories`, and `exercises` remain open shared catalog data — _since tightened: the catalog is read-only (SELECT only) for signed-in users and anon has no table access_
- [x] Seed `categories` — exactly 6: Chest, Back, Shoulders, Legs, Arms, Abs & Core
- [x] Seed `subcategories` and `exercises` from the Gym Exercise Library & Execution Guide — _as built: 26 subcategories and 86 exercises; Push-Ups and (V2) eleven single-arm Arms exercises later brought it to 98_
- [x] Verify schema via test queries in Supabase Studio, including a join across exercises → subcategories → categories to confirm the hierarchy resolves correctly

**Definition of Done:** Full schema live in Supabase, seeded with the complete exercise hierarchy, queryable and access-controlled.

---

## Phase 2 — Exercises Page

**Goal:** A working, hierarchically browsable exercise catalog.

- [x] Build the Exercises page route and layout
- [x] Browse by category → subcategory, with each subcategory showing its target muscle and technique description once
- [x] List exercise variations under each subcategory
- [x] Exercise detail view

**Definition of Done:** AJ can browse the full catalog by category and subcategory, see the technique and target muscle info for each movement group, and see which exercises are grouped together as natural variations of each other.

---

## Phase 3 — Programs Page (Builder)

**Goal:** AJ can build and edit his weekly Mon–Sun program with full customizability — the core spreadsheet-replacement feature.

- [x] Small spike: prototype the grid library choice (Glide Data Grid vs. TanStack Table) to confirm feel before committing — _resolved without a grid library: custom day rows with cascading selects_
- [x] Build the weekly Mon–Sun layout shell
- [x] Exercise picker as a 3-level cascading select: Category → Subcategory (filtered by category) → Exercise (filtered by subcategory)
- [x] Prescribed reps entry, exercise ordering within a day
- [x] Rest day toggle per day
- [x] Save program (updates the living template in place — no versioning)
- [x] Edit mode via pencil icon
- [x] *(Stretch)* Custom fields (JSONB) support surfaced in the builder UI

**Definition of Done:** AJ can fully build, save, and edit a real weekly program end-to-end — including picking exercises through the category/subcategory cascade — matching or exceeding the flexibility of the old spreadsheet.

---

## Phase 4 — Start Workout / Session Logging

**Goal:** AJ can run an actual gym session against his saved program and log real data on his phone.

- [x] "Start Workout" confirmation + session timer start
- [x] Display today's program day and its exercises
- [x] Per-set logging (reps done, weight)
- [x] Mark exercise complete (stamps timestamp)
- [x] Skip individual exercise
- [x] Per-exercise comment field
- [x] Pause / Resume timer
- [x] Finish workout → session status set to completed
- [x] Whole-day explicit "Skip" action
- [x] Mobile-first layout pass specific to this page (thumb-zone actions, large touch targets)

**Definition of Done:** AJ can complete, or skip, a real workout end-to-end on his phone, with every logging action working smoothly mid-session.

---

## Phase 5 — Home Page

**Goal:** A dashboard that reflects real session history — built last of the four pages since it's the one page with nothing to show until Phase 4 produces real data.

- [x] Weekly summary grid (completed / skipped / upcoming per day), distinct visual treatment
- [x] Monthly calendar view, clickable days linking to that day's logged session detail
- [x] Current bodyweight display + quick-add entry — _moved to Profile_
- [x] Goal bodyweight field — _moved to Profile_
- [x] Total workouts + last-30-days stat, distinct visual treatment

**Definition of Done:** Home page accurately reflects real logged history and gives an at-a-glance view of the month.

---

## Phase 6 — Mobile Polish & PWA

**Goal:** The app feels like a real app in the gym, not a responsive website.

- [x] Full responsive pass across all four pages
- [x] PWA manifest + service worker, installable to home screen
- [x] Real-device testing during an actual gym session
- [x] Fix friction points found in real use

**Definition of Done:** AJ replaces his Google Sheet with AJFit for a full week of real training, with no blocking friction.

---

## V2 — Ezlyfts (shipped)

Planned in `docs/V2_Implementation_Plan.md` (Phases 0–5, decisions D1–D14, all
approved). Each phase was committed separately and verified against the local
Supabase stack with the regression suites in `tests/` (`npm test`).

| V2 phase | What shipped | Commit |
| --- | --- | --- |
| 0 | Units columns, height, `onboarded_at`; `session_exercises.exercise_id` snapshot + trigger; `exercise_prs()`; unilateral Arms; `brand.ts`, `units.ts`; rebuilt test harness | `77af078` |
| 1 | Start heading fixed (three causes); instant logging via client state + ordered write queue; `bom1` region | `65063d0` |
| audit | Server Action auth sweep, RLS cross-user tests; `loadMonth` guard and atomic `saveProgram` fixes | `99d6d4f` |
| B | Logged history no longer pins the Split (slot link ON DELETE SET NULL, order/reps snapshot), slot-ownership RLS, catalog REFERENCES/TRIGGER revoked | `36e5114` |
| 2 | Weekly lock, one-button rest timer, PRs on Start, finish guard, stale-deploy replay, `deploymentId` | `a73c0fd` |
| 3 | Home status colours and legend, read-only day detail, workout initials | `7b27643` |
| B fix | Idempotent pause totals; live-build migration safety tests | `46a7932` |
| — | VS Code one-click sync disabled for the repo | `98afd6c` |
| 4 | Units settings, onboarding, BMI, `/profile/prs` | `ea0b440` |
| 5 | "My Workout Split", 120s default rest, Ezlyfts branding and icons, SW cache v2 | `f4abe8e` |
| 5 | Docs sync (this file, PRD, Design Language, handoff summary) | this commit |

Out of scope for V2 and still open: the final logo/redesign, offline logging,
store release (Phase 7), max-reps PRs, left/right tagging on unilateral sets,
±15s rest adjustment.

---

## Phase 7 — Native App Release

**Goal:** AJFit is installable from the App Store and Play Store.

- [ ] Integrate Capacitor around the existing Next.js app
- [ ] Add native plugins: haptics, local notifications (rest timer)
- [ ] Integrate offline-first sync layer (PowerSync or ElectricSQL)
- [ ] Real-device QA on iOS and Android
- [ ] Prepare store assets (icons, screenshots, listing copy)
- [ ] Submit to App Store / Play Store

**Definition of Done:** AJFit is installable from both stores and works reliably offline in a gym with poor signal.

---

## Phase 8 — Post-Launch Enhancements (Backlog)

**Goal:** Everything explicitly deferred in the PRD's Future Considerations, tackled as priorities emerge.

- [ ] Progress analytics: volume trends, estimated 1-rep max _(PR detection shipped in V2)_
- [ ] Push notifications
- [ ] Multi-user hardening, if pursuing a public release _(partly done: real accounts, per-user RLS audited, action auth sweep in the test suite)_
- [ ] Database backups decision

**Definition of Done:** Ongoing backlog — no fixed exit criteria.
