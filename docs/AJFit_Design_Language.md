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
