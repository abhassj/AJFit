# Ezlyfts (formerly AJFit) — V2 Implementation Plan

**Status:** Draft
**Version:** 1.0
**Last updated:** October 10, 2026
**Companion docs:** PRD v1.1, Design Language v2.0, Implementation Plan v1.1, Project Handoff Summary

---

## 1. Scope

| # | Area | Item | Phase |
|---|---|---|---|
| 1 | Start | Bug: heading shows the wrong workout (e.g. Back & Biceps on a Shoulders & Legs day) | 1 |
| 2 | Start | Bug: set logging and buttons feel slow | 1 |
| 3 | Start | Lock a completed day for the rest of the week, shown green | 2 |
| 4 | Start | Rest timer: one button instead of "Next Set" + "Skip Rest", interface redesigned | 2 |
| 5 | Start | Show the user's PR next to each exercise | 2 |
| 6 | Home | Calendar: finished day = green even if exercises were skipped; red only for a whole-day skip | 3 |
| 7 | Home | Tapping a date shows a clean read-only detail view first, "Edit logged workout" at the bottom | 3 |
| 8 | Home | Weekly bars show workout initials (BB, CT, SL) | 3 |
| 9 | Profile | Units: kg/lbs and cm/ft, applied across the whole app (defaults kg, cm) | 0 + 4 |
| 10 | Profile | Onboarding page after signup, popup for existing users | 4 |
| 11 | Profile | BMI calculator with animated popup and a comment on the result | 4 |
| 12 | Profile | PR page, grouped by category | 4 |
| 13 | Split | Default rest timer of 2 minutes on newly added exercises | 5 |
| 14 | Split | Page title becomes "My Workout Split" | 5 |
| 15 | Workouts | Single-arm (unilateral) exercises in the Arms catalog | 0 + 5 |
| 16 | Branding | Rename to Ezlyfts, monogram "Ez" | 5 |

**Out of scope for v2:** the new logo and app redesign (you said later), offline logging, App Store / Play Store release, max-reps PRs for bodyweight exercises, left/right tagging on unilateral sets, ±15s rest adjustment.

---

## 2. Decisions

### Locked (you stated these)
- Name is **Ezlyfts**, monogram **Ez**. The logo and design come later.
- Units default to **kg** and **cm**.
- Page title is **"My Workout Split"**.
- Rest timer default is **2 minutes**, editable or removable.
- Red appears only when the user explicitly skips the whole day.

### Proposed defaults — change any before building

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Unit storage | The database always stores **kg and cm**. The unit preference only affects input and display. | Converting stored data when the toggle flips would slowly corrupt history through rounding. |
| D2 | Where the preference lives | `profiles` table, not localStorage. | Follows the user across devices and is available during server render. The layout already fetches the profile, so there is no extra query. |
| D3 | Exercise identity on logs | Add `session_exercises.exercise_id` as a snapshot of which exercise was actually performed. | Today a log points at a program slot. If a slot is later changed from Flat DB Press to Incline DB Press, every old set silently becomes an Incline set, which would corrupt PRs and history. |
| D4 | PR definition | Heaviest weight in any set from a **completed** session. Tie → most reps, then earliest date. | Matches "highest weight recorded". |
| D5 | PR grouping | Grouped by **exercise name**, not row id. | Romanian Deadlift exists under both Back and Legs as separate rows, so grouping by id would split its PR. It will show in both categories with the same value. |
| D6 | Weekly lock | A day is locked once it has a **completed** session this week (Mon–Sun, viewer timezone). Skipped days and rest days never lock. Locking blocks a new Start only. Editing through Home stays allowed. | Skipping shouldn't prevent doing the day later. |
| D7 | Day initials | Derived automatically from the day title. Max 3 letters. A single word uses its first two letters. | Zero setup for the user. |
| D8 | Green rule edge case | If every exercise was skipped, Finish asks "No exercises completed. Finish anyway or mark the day skipped?" | Avoids a green day with no work behind it. |
| D9 | Onboarding | Name, bodyweight and height required. Motto optional. Existing users can tap "Later" and see the popup again next session. | A forced popup on every page load would be hostile. |
| D10 | 2-minute default | Client-side default for newly added exercises only. The database default stays null, and existing rows are untouched. | Null deliberately means "no timer". |
| D11 | Unilateral exercises | Added to existing Arms subcategories, not a new subcategory. One logged set means one round of both sides. | Subcategories share one `target_muscle` and `how_to_perform`. A mixed biceps and triceps subcategory would break that. |
| D12 | Brand constants | One `brand.ts` holds name, short name and monogram. The domain `aj-fit.vercel.app`, the GitHub repo, DB names and package name stay as they are. | The later logo swap becomes a one-file change. A domain or repo rename would also need Supabase Site URL, Redirect URLs and the GitHub integration reworked. |
| D13 | BMI | WHO adult bands, with a note that BMI can't tell muscle from fat and the ranges are for adults. | The audience is athletes and students. Muscular users often read as "overweight". |
| D14 | Rest timer button | One button. It reads "Skip Rest" while counting down and "Next Set" once the timer finishes. Same action either way. | One action, one control. |

---

## 3. Phase overview

| Phase | Name | Depends on |
|---|---|---|
| 0 | Groundwork: schema, shared utilities, test harness | — |
| 1 | Start: correctness and speed | 0 |
| 2 | Start: lock, rest timer, PRs | 0, 1 |
| 3 | Home | 0 |
| 4 | Profile: units, onboarding, BMI, PR page | 0 |
| 5 | Split, Workouts, branding, docs | 0–4 |

Ship each phase to `main` separately. Phase 1 is hotfix-grade because friends are using the app now.

---

## Phase 0 — Groundwork

**Goal:** Everything later phases share exists first.

**Migration A: schema** (separate file)
- [ ] `profiles`: add `weight_unit` (`kg`|`lbs`, default `kg`), `height_unit` (`cm`|`ft`, default `cm`), `height_cm numeric` (nullable, range-checked), `onboarded_at timestamptz` (nullable).
- [ ] `session_exercises`: add `exercise_id` (FK to `exercises`, ON DELETE RESTRICT), backfill from `program_exercises`, then set NOT NULL. Add a BEFORE INSERT trigger that fills `exercise_id` from `program_exercise_id` when it is null. The trigger makes deploy order safe, because migrations auto-apply on push while the app deploys separately, and it covers the Start and backfill flows without code changes.
- [ ] SQL function `exercise_prs(...)`, SECURITY INVOKER so RLS applies. Returns exercise name, category, best weight, reps at that weight and date achieved. It excludes null and non-positive weights, counts completed sessions only, and accepts an optional name filter and an optional session id to exclude. Explicit GRANT EXECUTE to `authenticated` only.
- [ ] Verify with two real user sessions that user B never sees user A's PRs.

**Migration B: catalog** (separate file, idempotent with ON CONFLICT DO NOTHING)

Proposed Arms additions (trim or extend):

| Subcategory | New exercises |
|---|---|
| Standard & Short-Head Bicep Variations | Single-Arm Cable Curl, Single-Arm Preacher Curl, Concentration Curl |
| Neutral / Hammer Curl Variations | Single-Arm Cable Hammer Curl, Cross-Body Hammer Curl |
| Tricep Pushdown Variations | Single-Arm Cable Pushdown, Single-Arm Reverse-Grip Pushdown |
| Tricep Extension Variations | Single-Arm Cable Tricep Extension, Single-Arm Overhead Cable Extension, Single-Arm Overhead Dumbbell Extension, Dumbbell Tricep Kickback |

**Code**
- [ ] `brand.ts` (name, short name, monogram) and use it in all new UI from here on.
- [ ] `units.ts`: `toKg`, `fromKg`, format and parse for weight, plus cm ↔ ft/in. Unit tests including round-trip (135 lb → kg → 135.0 lb).
- [ ] `UnitsProvider` fed by the existing `(app)` layout profile fetch, plus a server helper `getViewerUnits()`.

**Test harness**
- [ ] Run the regression suites against the local Supabase stack with email confirmation disabled in its config. This sidesteps the problem that live signups now need a clicked email.
- [ ] For live checks you create one confirmed test account and delete it afterward.

**Definition of Done**
- Both migrations applied through the GitHub integration (check the deploy log).
- The backfill leaves no null `exercise_id`.
- The PR function returns correct results on seeded data, including the Romanian Deadlift case.
- The unit utilities pass round-trip tests.
- All existing suites pass, with catalog count assertions updated for the new exercises.

---

## Phase 1 — Start: correctness and speed

**Goal:** Fix what friends feel today, measuring before changing.

**1.1 Heading bug**
- [ ] Reproduce first: default day, a manually chosen non-matching day, and the first-visit case where the server falls back to UTC and the client refreshes once.
- [ ] Leading hypotheses (confirm, don't assume): the heading is derived from the weekday instead of the selected day, or it is initialised from props and never re-synced after the one-render timezone correction.
- [ ] Fix: the selected `program_day` id is the single source of truth. The heading, exercise list and created session all derive from it.
- [ ] Check at the database level that `sessions.program_day_id` matches the heading the user saw.

**1.2 Speed**
- [ ] Measure before fixing: timing around each server action and DB call, and interaction latency (INP) on a real phone. Phase 6 only measured page load, which is why this lag never showed up in Lighthouse.
- [ ] **Check the region mismatch first.** Vercel functions default to US East. Your Supabase project is in Asia-Pacific. Every action may be crossing the Pacific twice. Confirm the exact Supabase region (Settings → Infrastructure) and set the Vercel function region to match (`bom1` Mumbai or `sin1` Singapore). One region is enough.
- [ ] Look for full-tree revalidation after every action (`revalidatePath` or `router.refresh` in the tap path) and for sequential awaits that could run in parallel.
- [ ] Architecture fix: client state is the source of truth during a session. Sets get client-generated UUIDs and update optimistically. Writes go through an ordered queue. A visible saving/saved/failed state with retry means no silent failures. No refresh in the tap path, and server actions return minimal data.
- [ ] Targets: tap-to-visual-response under 100 ms regardless of network, and background save under about 500 ms from India after the region change.

**1.3 Units in the logger**
- [ ] Every weight on Start goes through the units utility. The keypad accepts the display unit and stores kg.

**Definition of Done**
- The heading is correct for every weekday and for a non-matching chosen day, with a regression test for each.
- Before and after timings are recorded from a real phone.
- The UI stays responsive on a throttled connection, and failed saves are visible and retryable.
- All prior suites pass.

---

## Phase 2 — Start: lock, rest timer, PRs

**2.1 Weekly lock**
- [ ] Query completed sessions in the current Mon–Sun week, using the viewer-timezone utility, to get the set of locked `program_day` ids.
- [ ] The day picker shows locked days green with "Done · Mon" and disabled. When every training day is done, show a "Week complete" state.
- [ ] Enforce in the start-session server action too, so a stale tab can't double-start a locked day.
- [ ] A locked day links to the Home detail view for editing.
- [ ] Backfill warns on an already-completed day but does not block.

**2.2 Rest timer**
- [ ] One button per D14. Remove the duplicate handler and its code path.
- [ ] Redesign the overlay around it: ring, large digits, "Exercise · Set 2 of 3", a single full-width glass button, and a pulse on completion.
- [ ] Keep the timestamp-based accuracy and the completion vibration. Respect reduced-motion.

**2.3 PR beside each exercise**
- [ ] One `exercise_prs` call for today's exercises, excluding the current session. Display "PR 25 kg" in the user's unit, or "No PR yet".
- [ ] A client-side "New PR" badge when a logged set beats the prior PR.

**2.4 Finish guard** (D8)
- [ ] Confirmation when finishing with zero completed exercises.

**Definition of Done**
- Completed days lock for the week and unlock on Monday in the viewer's timezone, tested in two timezones.
- A stale-tab start attempt on a locked day is rejected by the server.
- The rest timer has one button and works across lock and background.
- PRs match a direct SQL check.
- All prior suites pass.

---

## Phase 3 — Home

**3.1 Status colours**
- [ ] `completed` → green regardless of per-exercise skips. `skipped` → red. Missed days stay neutral, never red. `in_progress` is neither. Rest and upcoming are unchanged.
- [ ] Apply to both the weekly bar and the monthly calendar. Add a small legend under the existing hint.

**3.2 Day detail, read-only first**
- [ ] Header with date, workout title, status, duration (when timing exists) and X of Y exercises done.
- [ ] Each exercise lists its sets (number, weight in the user's unit, reps), comment and skipped label.
- [ ] "Edit logged workout" at the bottom opens the existing editable view. Saving returns to the detail view.
- [ ] Empty past days still open the backfill flow. Future days stay untappable.

**3.3 Weekly initials**
- [ ] `dayInitials(title)`: split on `&`, "and", `,`, `+`, `/`, then take the first letter of each part (max 3). A single word uses its first two letters.
- [ ] The source is the program day actually performed (`sessions.program_day_id`), not the weekday. A null title falls back to a neutral label.
- [ ] Unit tests: Back & Biceps → BB, Chest & Tri → CT, Shoulders & Legs → SL, Shoulder, Legs & Core → SLC, Legs → LE.
- [ ] Known limitation: renaming a day later changes old labels. Accepted for v2.

**Definition of Done**
- A skipped-exercise-but-finished day is green on both views.
- A whole-day skip is red, and a missed day is neutral.
- The detail view is read-only until the user taps Edit.
- Initials are correct for flexible-day sessions.
- All prior suites pass.

---

## Phase 4 — Profile

**4.1 Units settings**
- [ ] Segmented controls for kg/lbs and cm/ft, saved to `profiles`. Height in ft takes feet and inches inputs.
- [ ] Bodyweight and goal inputs honour the unit. No stored data is converted.

**4.2 Onboarding**
- [ ] `/onboarding` page: name, motto (optional), bodyweight, height (with unit selectors). Validate ranges. Saves the profile, writes today's `weight_logs` row using the viewer-timezone date, and sets `onboarded_at`.
- [ ] Flow: signup → confirm email → `/onboarding` → Home.
- [ ] Existing users with a null `onboarded_at` get a dismissible popup, prefilled with what they already have.
- [ ] Use upsert. The profile row may not exist.

**4.3 BMI**
- [ ] A BMI row on Profile opens a modal. A short (about 2.5 s) animated sequence plays: a gauge sweeps, the number counts up, then the result and category appear. Use Framer Motion with LazyMotion and animate transform and opacity only. Reduced motion shows the result instantly.
- [ ] Computed from the latest `weight_logs` entry and `height_cm`, always in metric.
- [ ] A neutral, encouraging comment per band, never pushing weight loss, plus the D13 note. If height or weight is missing, prompt the user to add it.

**4.4 PR page**
- [ ] `/profile/prs`, entered from a row on Profile. Categories in catalog `sort_order`, with exercises that have data listed under each: name, PR in the user's unit, reps at that weight and date.
- [ ] Empty state for new users. Bodyweight-only exercises are excluded, with a one-line note.
- [ ] One `exercise_prs` call. Follows the v2.0 glass language without nested cards.

**Definition of Done**
- A new signup lands on onboarding after confirming and ends with a populated profile and a weight entry.
- The existing-user popup appears once per session until completed.
- Toggling units changes display everywhere with no change to stored values (verified in the DB).
- BMI matches hand calculations for each band.
- The PR page matches a direct SQL check.
- All prior suites pass.

---

## Phase 5 — Split, Workouts, branding, docs

**5.1 Split**
- [ ] 120 s default on newly added exercises (D10). It can be cleared to null. Copy-day copies the value as is.
- [ ] Title "My Workout Split" in the heading, page `<title>` and any aria labels.

**5.2 Workouts**
- [ ] Verify the Phase 0 catalog additions render correctly in the right subcategories.

**5.3 Branding**
- [ ] Ezlyfts everywhere user-facing: metadata, auth pages, onboarding, empty states, manifest name and short name.
- [ ] Regenerate the PWA icon set as an "Ez" monogram in the current glass style. It is a placeholder until the real logo.
- [ ] Bump the service worker cache version.
- [ ] Grep audit for leftover "AJFit" strings in user-facing code.

**5.4 Docs sync**
- [ ] Update the PRD (units, height, onboarding, `session_exercises.exercise_id`, PR function, sort_order, motto, rest_seconds), the Design Language (BMI modal, PR page, rest timer, calendar legend) and the Implementation Plan and Handoff Summary.

**Definition of Done**
- No "AJFit" left in user-facing text.
- The manifest and icons show Ezlyfts / Ez.
- Docs match the shipped app.
- All prior suites pass.

---

## 4. Verification policy

- Re-run every existing suite at the end of every phase, with any intentionally changed assertion commented, never deleted.
- Verify against the database, not just the UI.
- Run the multi-timezone check (Kolkata, London, plus a fixed-offset zone like Muscat) for Phase 2's lock and Phase 4's onboarding weight entry.
- Do a real-device pass on iPhone and Android after Phases 1, 2 and 4.
- Keep Lighthouse mobile at or above current numbers, and record INP before and after Phase 1.

## 5. Manual steps (you)

1. Confirm your Supabase region (Settings → Infrastructure) before Phase 1, and set the Vercel function region to match.
2. Review the unilateral exercise list in Phase 0.
3. Create one confirmed test account on live for verification, and delete it afterward with `delete from auth.users where email like 'ajfit.%@gmail.com';`.
4. After the rename ships: update the confirmation email template wording in Supabase (Authentication → Email Templates).
5. After the rename ships: tell iPhone friends to delete and re-add the home screen icon. iOS keeps the old name and icon from install time.
6. Reminder: the backups decision is still open, and PR history makes data loss costlier.

## 6. Risks

| Risk | Mitigation |
|---|---|
| The D3 backfill assumes each slot's current exercise was always the one performed | Unavoidable for past data. Correct from now on. |
| Optimistic UI hides failed saves | Ordered write queue with a visible failed state and retry. |
| Week boundaries differ by timezone | Use the existing viewer-timezone utility and test across zones. |
| Several migrations apply automatically on push | One file per concern, and check the deploy log after each. |
| Unit rounding drift | Store full precision, round only at display, and test the round trip. |
| Leftover "AJFit" strings in emails or docs | Grep audit and the manual email template step. |
| PR query slows as history grows | Measure after Phase 2. If needed, add a cached best-per-exercise table later. |
| BMI wording lands badly | Neutral copy, athlete-aware disclaimer, no weight-loss prompts. |
