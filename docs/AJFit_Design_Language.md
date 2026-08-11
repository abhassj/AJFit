# AJFit — Design Language

**Status:** Draft
**Version:** 1.0
**Last updated:** August 7, 2026
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

`Home` · `Workouts` (Exercises catalog) · `Program` (Programs builder) · `Start` (Start Workout)

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
