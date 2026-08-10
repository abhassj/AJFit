# AJFit

A personal workout programming and logging app. Replaces a Google Sheets
workflow with a real data layer and a mobile-first logging experience.

See [AJFit_PRD_v1.md](./AJFit_PRD_v1.md) and
[AJFit_Implementation_Plan.md](./AJFit_Implementation_Plan.md).

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres)
via `@supabase/ssr` · deployed on Vercel.

## Requirements

**Node.js 22 or later.** `@supabase/supabase-js` needs a native `WebSocket`
global and throws at client construction on Node 20 or below.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/sign-in` until you have a
session.

Only the Supabase **publishable/anon** key belongs in `.env.local` — never the
`service_role` key.

## Scripts

| Command                | Purpose                    |
| ---------------------- | -------------------------- |
| `npm run dev`          | Dev server                 |
| `npm run build`        | Production build           |
| `npm run start`        | Serve the production build |
| `npm run lint`         | ESLint                     |
| `npm run format`       | Prettier, write            |
| `npm run format:check` | Prettier, check only       |

## Project status

Phase 6 complete. Auth, the exercise catalog, the weekly program builder,
session logging, the Home dashboard, a profile page with avatar upload, and
retroactive logging of past days are all working. PWA manifest and service
worker remain a separate future step.

Visual reference: [docs/AJFit_Design_Language.md](./docs/AJFit_Design_Language.md).

## Structure

```
src/
  app/
    (app)/          Signed-in shell — backdrop, header with avatar, bottom nav
      page.tsx        Home dashboard (week summary, stats, calendar)
      workouts/       Exercise catalog, and [exerciseId] detail
      program/        Weekly Mon-Sun program builder
      start/          Live session logging with timer
      history/[date]/ Any calendar day — view, edit, or backfill a session
      profile/        Display name, avatar, bio, bodyweight and goal
    auth/           Server actions, shared auth form, email-confirm handler
    sign-in/        Sign-in page
    sign-up/        Sign-up page
  assets/           Static-imported images (optimised by next/image)
  components/       Shared UI — nav, backdrops, motion primitives, keypad
  lib/
    catalog.ts        Catalog queries      catalog-types.ts   client-safe types
    program.ts        Program queries      program-types.ts   client-safe types
    session.ts        Session queries      session-types.ts   client-safe types
    home.ts           Dashboard queries    home-types.ts      client-safe types
    profile.ts        Profile queries
    supabase/         Browser client, server client, proxy session refresh
  proxy.ts          Next.js proxy (formerly middleware) — refresh + route guard

supabase/migrations/  SQL migrations, applied via the GitHub integration
```
