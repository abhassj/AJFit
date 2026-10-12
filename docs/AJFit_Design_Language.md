# Ezlyfts (formerly AJFit) — Design Language

**Status:** Current — matches the shipped app as of V2
**Version:** 2.0
**Last updated:** October 12, 2026
**Source:** Extracted from AJ's mockup images (`/ui-mockups`), color-sampled directly rather than eyeballed

---

## How to use this document

This is the visual reference for every page going forward. It replaces re-interpreting the mockup screenshots from scratch each phase. Two things were deliberately dropped from the source mockups and should not appear anywhere in the build:

- **No illustrated character art or tagline branding** ("WATCH IT — BE BRAVE WITH YOUR LIFE" and the accompanying artwork). That was a mood reference only. Keep the UI clean and typographic instead.
- **No literal mockup text.** Labels like "Poor Done," "Incline Dise Exercise," "Gancer Dumbbell Press," "Low-to-High Cable Flye," and the garbled paragraph under "How to Perform" in the catalog mockup are AI-image-generation artifacts, not real copy. All real content comes from the actual database (exercise names, target muscles, technique descriptions) or from actual app state — never from mockup text.

---

## Color tokens

| Token            | Hex                                                                      | Usage                                                             |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `bg-base`        | `#13161B`                                                                | App background                                                    |
| `bg-card`        | `#1E2126`                                                                | Cards, panels — the session timer box, exercise cards, info cards |
| `text-primary`   | `#F6F9FE`                                                                | Headings, numbers, primary labels                                 |
| `text-secondary` | `#6E6E6E`                                                                | Sub-labels, captions, timestamps, dividers                        |
| `accent-danger`  | `~#E5484D` _(approximate — pin an exact value during implementation)_    | Primary/destructive actions — "Finish" button                     |
| `accent-success` | `~#22C55E` _(suggested — not precisely sampled from source, small area)_ | Completed-state checkmarks                                        |

The deep maroon tones sampled from the mockups (`#360D15`–`#3E0F16`) were part of the now-dropped background artwork/glow — not a UI token, safe to ignore.

**Accessibility note for implementation:** run a contrast check between `text-secondary` and `bg-card` once real components exist — mid-gray on dark card backgrounds can sit close to WCAG AA's minimum contrast ratio depending on font size, and it's easier to catch this before it's used everywhere than after.

---

## Typography

- Section headers and small labels: **bold, all-caps, letter-spaced** — e.g. "SESSION TIMER," "TARGET MUSCLES," "HOW TO PERFORM," "CURRENT SET." This is the consistent labeling convention across every mockup.
- Large numeric displays (timer, reps, weight): bold, tabular/monospaced-feeling digits, sized noticeably larger than body text — these are the numbers a user needs to read at a glance mid-set, so they should never compete visually with surrounding labels.
- Body/exercise names: regular weight, high contrast against `bg-card`.

---

## Component patterns

**Cards.** Rounded-corner panels in `bg-card` sitting on `bg-base`, used to group related info — the session timer, the current set input, the subcategory info block. This is the primary structural unit across every screen.

**Numeric entry.** Large tappable number fields (reps, weight) that open a keypad for direct entry, with the active field visually outlined/highlighted. Faster for gym use than a small stepper for anything beyond ±1.

**Triple-button action rows.** Recurring pattern: three actions in a row, one visually distinct (usually the destructive/final one in `accent-danger`). Seen as Pause / Resume / Finish, and separately as Previous Set / Mark Complete / Skip Exercise. Reuse this pattern anywhere three related actions need equal visual weight with one standing out.

**Subcategory info card + exercise list.** One shared card at the top (subcategory name, target muscle, how-to-perform), with individual exercise rows listed underneath, each with a leading icon and trailing chevron. This maps directly onto the catalog hierarchy already built — Phase 2 should use exactly this pattern.

**Completed-item log.** A list of entries, each with a checkmark, a name, and a timestamp ("Per-exercise at 1:37 PM"). This pattern fits both Phase 2 (browsing) loosely and, more directly, Phase 4's Start Workout session log — worth carrying forward rather than re-deriving later.

**Bottom tab navigation.** Four tabs, icon + label, active tab visually indicated (underline/highlight):

`Home` · `Workouts` (Exercises catalog) · `Split` (the builder, titled "My Workout Split") · `Start` (Start Workout)

_(V2: the third tab has read "Split" since the motto update; its page title is "My Workout Split".)_

---

## Open items

- Exact hex for `accent-danger` and `accent-success` should be finalized visually once real components exist, not derived purely from compressed mockup images.
- Icon set for the bottom nav and exercise list rows not yet chosen — pick one icon library and use it consistently (don't mix styles).

---

## Addendum — post-launch update (v1.2)

Added alongside the motto, rest-timer and flexible-day-execution work. This
section supersedes anything above it where the two disagree.

### Corrected token

`text-secondary` is **`#8B9099`**, not `#6E6E6E`. The original value measured
3.17:1 against `bg-card`, below WCAG AA for body text; `#8B9099` measures
5.03:1. The old value survives as **`--color-faint`** for the decorative uses it
genuinely suits — dividers, disabled glyphs, captions at 3:1.

### Page personalities

Programs and Workouts share the same tokens but must not read the same. They
are different kinds of screen and their layouts say so:

|           | Workouts                                  | Programs                                         |
| --------- | ----------------------------------------- | ------------------------------------------------ |
| Role      | Browsable reference                       | Builder / tool                                   |
| Container | **No cards.** Hairline-divided index rows | `.surface` control rows with a day rail          |
| Heading   | 26px category name, editorial masthead    | 17px day title behind a fixed-width weekday slot |
| Grouping  | Accent rail (`border-l-2`) + whitespace   | Bordered rows, status chips                      |

If a new page is a reference, follow Workouts. If it is a tool, follow
Programs.

### Nesting rule

**Do not put a card inside a card.** Before this pass the catalog boxed a
`.surface` article per subcategory and then boxed its exercise rows again
inside it. Both containers are gone; hierarchy now comes from type size,
weight, an accent rail and whitespace. Reach for typography before another
border — it reads better and is cheaper to paint.

### New patterns

**Chip row.** Short related values (target muscles) render as
`rounded-full border-hairline` pills rather than a bulleted list. Denser,
scannable, and no vertical rhythm cost.

**Day rail.** A fixed-width, bordered left column carrying the weekday
abbreviation. It is what makes a Programs row read as a control rather than an
article.

**Countdown ring.** A single SVG `<circle>` whose `stroke-dashoffset` is
animated. Never redraw an arc per frame in JS — animate the dash offset and let
the compositor do it.

**Motto headline.** The user's motto takes the Home headline slot at 30px bold
when set. When unset the heading simply reads "Dashboard" — never an empty
container or placeholder text posing as content.

### Motion

Micro-interactions use `whileTap={{ scale: 0.985–0.99 }}` on pressable rows,
and expand/collapse animates `opacity` + `y` — never `height`, which forces
layout. Everything routes through `MotionProvider` (`LazyMotion` + `m`
components, `strict`), so the eager Framer bundle can never creep back in.
All motion is disabled under `prefers-reduced-motion`.

### Timers

Any countdown or elapsed display must be **timestamp-based** — store the start
instant and compute against `Date.now()`. Never decrement a counter on an
interval: it drifts, and it stops entirely when the phone locks, which is
precisely when a rest timer is running.

---

## Addendum — production-readiness pass (v1.3)

Added when the app was opened to real accounts. Covers the states the design
language had never specified because, with one known user, they never showed.

### Failure state

One component, `ErrorState`, backs all three error boundaries. It is a centred
glass panel on the standard backdrop: a circled `AlertIcon` in `accent-danger`,
a 20px heading, a 14px `text-secondary` explanation, then **Try again** as the
primary action with **Back to Home** beneath it.

Two rules that are easy to get wrong:

- **Never print the thrown message.** Next replaces it with a generic string in
  production, so it is either useless or a leak. The `digest` is shown instead,
  small and monospaced, as the handle that matches a server log line.
- **Retry is the primary action, not a suggestion.** Nearly every failure here
  is a Supabase request that did not come back — a basement gym, a phone that
  woke on a different network. Retrying usually works, so it gets the filled
  button.

The boundary inside `(app)` renders with the header and bottom navigation
intact. A page that fails must still leave the other three tabs one tap away.

### Loading state

Skeletons, never spinners. Each page's `loading.tsx` mirrors that page's real
block heights so content lands without the layout jumping — the seven day rows
on Split, the six illustrated tiles on Workouts, the segment bar and month grid
on Home. Placeholders are `bg-white/[0.06]` with `animate-pulse`, wrapped in
`aria-busy` with a visually hidden "Loading…" so a screen reader hears the wait
rather than a screenful of empty boxes.

### Field validation

Invalid controls take `border-danger/70 ring-1 ring-danger/30`, with a 12px
`accent-danger` message directly beneath carrying `role="alert"` — colour alone
is never the signal. Messages are full sentences that say what to do
("Reps must be at least 1."), not labels ("Invalid").

Validation appears **only after the first save attempt**. Marking a field red
while someone is still filling it in is hostile; waiting means every message
shown is about something the user considers finished. When the offending field
is inside a collapsed section, the summary banner names the day and the section
opens itself.

### App icon

Dark `bg-base` ground, the same red ambience used behind every page masthead, a
frosted-glass pane lit from the top-left, and an **AJ** monogram over a single
`accent-danger` bar. _(Superseded in V2: the monogram is now **Ez** — see the
V2 addendum.)_ A wordmark is illegible at 192px and a dumbbell glyph looks
like every other fitness app on the home screen; the monogram is neither.

Icons are generated by a script rather than hand-drawn, and ship in both `any`
and `maskable` purposes — Android crops maskable icons to the launcher's shape,
so the mark sits inside the middle 80% there and the tile is full-bleed.

---

## Addendum — V2, Ezlyfts (v2.0)

Added with the V2 work (units, onboarding, BMI, PRs, weekly lock, rest timer,
Home detail). Supersedes anything above where the two disagree. The motion and
blur rules stand: animate **transform and opacity only**, route everything
through `MotionProvider` (`LazyMotion` + `m`), and add **no new backdrop-blur**
(the rest timer now has one fewer).

### Name and icon

The product is **Ezlyfts**; the monogram is **Ez**. Every user-facing name
comes from `src/lib/brand.ts`, so the real logo is a one-file swap. The icon
keeps the v1.3 construction (dark ground, red ambience, glass pane, white
monogram over one `accent-danger` bar) with "Ez" as a placeholder.
`scripts/generate-icons.mjs` renders every size from one SVG; after changing
art, bump `CACHE` in `public/sw.js`.

### Status colours

One rule across the weekly bar and the month calendar:

| State       | Colour                | Meaning                                                    |
| ----------- | --------------------- | ---------------------------------------------------------- |
| Completed   | `accent-success`      | A finished session — even if single exercises were skipped |
| Skipped     | `accent-danger`       | A whole-day skip, and only that                            |
| In progress | neutral, primary ring | Started, not finished — never green or red                 |
| Not logged  | neutral               | A past day with nothing logged is not a failure            |
| Rest        | muted                 | A rest day in the Split                                    |

A small legend sits directly under the calendar's hint line.

### Weekly initials

Under each bar segment, the initials of the workout actually performed that
day (from the session's own program day, not the weekday): "Back & Biceps" →
**BB**, "Shoulder, Legs & Core" → **SLC**, a single word takes two letters
("Legs" → **LE**). 11px bold, coloured by status; blank when nothing was
logged; a neutral dot when the day had no title.

### Day detail (read-only first)

Tapping a logged day opens a read-only page: status eyebrow (coloured), the
workout title, the date, a three-figure summary (Duration · Exercises "X of Y"
· Sets), then each exercise with its sets as aligned columns (weight in the
user's unit, reps), its comment in italics and a Skipped label. **Edit logged
workout** is a full-width secondary button at the bottom; the editor's **Done
Editing** returns here.

### Rest timer

One full-width button, bottom of the screen: **Skip Rest** while counting,
**Next Set** (success tint, chevron) once done — the same action either way.
Above the ring: "Resting" and "Exercise · Set 2 of 3" (the set count comes
from the prescription when it names one). The ring keeps its `stroke-dashoffset`
countdown; completion adds a short scale pulse on the ring's wrapper (a
transform) and the vibration. Reduced motion: colour change only.

### Weekly lock

A finished day shows **Done · Mon** in `accent-success` on a `success/10` row,
disabled in the day picker. When today's own workout is done, a green banner
replaces the Start action and links to that day on Home. When every training
day is done: a centred **Week Complete** state listing them.

### Personal records

- Beside each exercise (Start list and live panel): "PR 60 kg × 8" or "No PR
  yet", 13–14px `text-faint`.
- **New PR** badge on the set that beats the record: a `success/15` pill,
  11px bold uppercase `accent-success`. Only the set that raised the bar.
- `/profile/prs`: category headings as plain `label-caps` text (no nested
  cards — one `.surface` list per category), rows with name and date on the
  left and weight (bold) over "× reps" on the right.

### Segmented control

Unit pickers (kg | lbs, cm | ft) are a `radiogroup` of pill buttons inside a
`card-raised` track; the active option is a filled `primary` pill.

### BMI dialog

A bottom sheet on phones (centred above `sm`), `bg-card` panel over a
`black/70` scrim — no blur. A semicircle gauge with four band arcs (the
current band at full opacity, the rest at 30%), a needle that **rotates**
into place, the value counting up beneath it, then the band label (in the
band's colour), one neutral sentence and the fixed note "BMI can't tell muscle
from fat, and these ranges are for adults." About 2.5s end to end; instant
under reduced motion. Copy never suggests losing weight.

### Onboarding

`/onboarding` uses the standard page masthead and one `.surface` form. The
prompt for older accounts is the same form in a sheet, with **Later** beside
**Save and continue**.

### Save status on the live workout

Quiet when saved; a pulsing "Saving…" `label-caps` beside the heading while
writes are in flight. A failed save is an opaque alert **pinned above the
bottom navigation** (not in the page flow, where it would be off-screen at the
keypad) with a Retry button. Copy for a dropped connection: "No connection.
Your entries are safe on this screen."
