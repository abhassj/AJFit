# AJFit — Implementation Plan

**Status:** Draft
**Version:** 1.0
**Last updated:** August 4, 2026
**Companion doc:** AJ's Workout Tracker PRD v1

---

## How to use this document

Each phase below has a goal, a task checklist, and a **Definition of Done**. Don't start a phase until the previous one's Definition of Done is met — this keeps the build linear and avoids half-finished dependencies stacking up.

> **Note on phase numbering:** this document breaks the PRD's "Phase 1: Web App" into eight granular build phases (0–6 = core web app, 7 = mobile polish). The PRD's "Phase 2: Native Release" corresponds to Phase 7 here, and the PRD's "Phase 3: Future" corresponds to Phase 8.

---

## Phase overview

| Phase | Name                            | Depends on |
| ----- | ------------------------------- | ---------- |
| 0     | Project Setup & Foundations     | —          |
| 1     | Database Schema & Seed Data     | Phase 0    |
| 2     | Exercises Page                  | Phase 1    |
| 3     | Programs Page (Builder)         | Phase 1, 2 |
| 4     | Start Workout / Session Logging | Phase 3    |
| 5     | Home Page                       | Phase 4    |
| 6     | Mobile Polish & PWA             | Phase 2–5  |
| 7     | Native App Release              | Phase 6    |
| 8     | Post-Launch Enhancements        | Phase 7    |

---

## Phase 0 — Project Setup & Foundations

**Goal:** A deployed, authenticated skeleton with the full toolchain wired up, so every later phase is pure feature work.

- [ ] Initialize Next.js (TypeScript) project, App Router
- [ ] Install and configure Tailwind CSS
- [ ] Set up ESLint / Prettier conventions
- [ ] Create Supabase project (dev environment)
- [ ] Wire Supabase client (browser + server) into Next.js
- [ ] Set up environment variables (local `.env`, Vercel project settings)
- [ ] Push repo to GitHub
- [ ] Deploy a minimal build to Vercel to confirm the pipeline end-to-end
- [ ] Basic Supabase Auth flow (sign in / sign out)

**Definition of Done:** A logged-in user lands on a blank authenticated shell, deployed and reachable on the web.

---

## Phase 1 — Database Schema & Seed Data

**Goal:** Every table from the PRD exists in Supabase, secured, and the exercise catalog has real starting data.

- [ ] Write SQL migration for all core tables: `profiles`, `weight_logs`, `categories`, `exercises`, `programs`, `program_days`, `program_exercises`, `sessions`, `session_exercises`, `sets`
- [ ] Add Row Level Security policies scoping every table to the authenticated user
- [ ] Seed `categories` (Chest, Back, Legs, Shoulders, Core, etc.)
- [ ] Seed `exercises` from AJ's existing spreadsheet exercise list, tagged with `movement_pattern`
- [ ] Verify schema via test queries in Supabase Studio

**Definition of Done:** Full schema live in Supabase, seeded with AJ's real exercises, queryable and access-controlled.

---

## Phase 2 — Exercises Page

**Goal:** A working, browsable exercise catalog.

- [ ] Build the Exercises page route and layout
- [ ] List all exercises, filterable/grouped by category
- [ ] Exercise detail view
- [ ] "Alternates" section, pulling exercises that share a `movement_pattern`

**Definition of Done:** AJ can browse the full catalog by category and see relevant alternates for any exercise.

---

## Phase 3 — Programs Page (Builder)

**Goal:** AJ can build and edit his weekly Mon–Sun program with full customizability — the core spreadsheet-replacement feature.

- [ ] Small spike: prototype the grid library choice (Glide Data Grid vs. TanStack Table) to confirm feel before committing
- [ ] Build the weekly Mon–Sun layout shell
- [ ] Exercise picker pulling from the catalog, grouped by category
- [ ] Prescribed reps entry, exercise ordering within a day
- [ ] Rest day toggle per day
- [ ] Save program (updates the living template in place — no versioning)
- [ ] Edit mode via pencil icon
- [ ] _(Stretch)_ Custom fields (JSONB) support surfaced in the builder UI

**Definition of Done:** AJ can fully build, save, and edit a real weekly program end-to-end, matching or exceeding the flexibility of the old spreadsheet.

---

## Phase 4 — Start Workout / Session Logging

**Goal:** AJ can run an actual gym session against his saved program and log real data on his phone.

- [ ] "Start Workout" confirmation + session timer start
- [ ] Display today's program day and its exercises
- [ ] Per-set logging (reps done, weight)
- [ ] Mark exercise complete (stamps timestamp)
- [ ] Skip individual exercise
- [ ] Per-exercise comment field
- [ ] Pause / Resume timer
- [ ] Finish workout → session status set to completed
- [ ] Whole-day explicit "Skip" action
- [ ] Mobile-first layout pass specific to this page (thumb-zone actions, large touch targets)

**Definition of Done:** AJ can complete, or skip, a real workout end-to-end on his phone, with every logging action working smoothly mid-session.

---

## Phase 5 — Home Page

**Goal:** A dashboard that reflects real session history — built last of the four pages since it's the one page with nothing to show until Phase 4 produces real data.

- [ ] Weekly summary grid (completed / skipped / upcoming per day), distinct visual treatment
- [ ] Monthly calendar view, clickable days linking to that day's logged session detail
- [ ] Current bodyweight display + quick-add entry
- [ ] Goal bodyweight field
- [ ] Total workouts + last-30-days stat, distinct visual treatment

**Definition of Done:** Home page accurately reflects real logged history and gives an at-a-glance view of the month.

---

## Phase 6 — Mobile Polish & PWA

**Goal:** The app feels like a real app in the gym, not a responsive website.

- [ ] Full responsive pass across all four pages
- [ ] PWA manifest + service worker, installable to home screen
- [ ] Real-device testing during an actual gym session
- [ ] Fix friction points found in real use

**Definition of Done:** AJ replaces his Google Sheet with AJFit for a full week of real training, with no blocking friction.

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

- [ ] Progress analytics: volume trends, estimated 1-rep max, PR detection
- [ ] Push notifications
- [ ] Multi-user hardening, if pursuing a public release

**Definition of Done:** Ongoing backlog — no fixed exit criteria.
