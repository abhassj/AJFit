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

Phase 2 complete — auth foundations, the full catalog schema, and a read-only
Exercises catalog. Program (Phase 3), Start Workout (Phase 4) and Home
(Phase 5) are placeholder routes so the bottom navigation has four real
destinations.

Visual reference: [docs/AJFit_Design_Language.md](./docs/AJFit_Design_Language.md).

## Structure

```
src/
  app/
    (app)/          Signed-in shell — ambient backdrop + bottom tab navigation
      page.tsx        Home (placeholder until Phase 5)
      workouts/       Exercise catalog, and [exerciseId] detail
      program/        Placeholder — Phase 3
      start/          Placeholder — Phase 4
    auth/           Server actions, shared auth form, email-confirm handler
    sign-in/        Sign-in page
    sign-up/        Sign-up page
  components/       Shared UI — nav, backdrop, catalog browser, icon set
  lib/
    catalog.ts        Server-side catalog queries
    catalog-types.ts  Shapes and pure helpers, safe for Client Components
    supabase/         Browser client, server client, proxy session refresh
  proxy.ts          Next.js proxy (formerly middleware) — refresh + route guard

supabase/migrations/  SQL migrations, applied via the GitHub integration
```
