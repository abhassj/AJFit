-- AJFit — Phase 1: core schema, row level security, and catalog seed data.
--
-- The schema is split in two halves (see PRD §7):
--   template — programs / program_days / program_exercises, the reusable plan
--   log      — sessions / session_exercises / sets, dated records of what
--              actually happened
--
-- Ownership is anchored on auth.users. User-owned tables carry user_id
-- directly; their children are reached through EXISTS joins in the RLS
-- policies rather than denormalising user_id down the tree.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  goal_bodyweight numeric,
  created_at timestamptz not null default now()
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight numeric not null
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  -- Drives the "alternates" feature: exercises sharing a movement_pattern are
  -- surfaced as substitutes for one another (PRD §8.5).
  movement_pattern text not null,
  description text
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  day_of_week text not null check (
    day_of_week in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )
  ),
  title text,
  is_rest_day boolean not null default false
);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  prescribed_reps text,
  exercise_order int not null,
  custom_fields jsonb not null default '{}'::jsonb
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable, and set null rather than cascade: a logged session is history
  -- and must survive the template day it was based on being deleted.
  program_day_id uuid references public.program_days (id) on delete set null,
  session_date date not null,
  status text not null check (status in ('completed', 'skipped', 'in_progress')),
  start_time timestamptz,
  end_time timestamptz,
  paused_duration interval not null default '0'
);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  program_exercise_id uuid not null references public.program_exercises (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  comment text
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  set_number int not null,
  reps_done int,
  weight numeric,
  comment text,
  custom_fields jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Postgres does not index foreign keys automatically. These matter more than
-- usual here because the RLS policies below re-walk the ownership chain on
-- every row access.
-- ---------------------------------------------------------------------------

create index weight_logs_user_id_log_date_idx on public.weight_logs (user_id, log_date desc);
create index exercises_category_id_idx on public.exercises (category_id);
create index exercises_movement_pattern_idx on public.exercises (movement_pattern);
create index programs_user_id_idx on public.programs (user_id);
create index program_days_program_id_idx on public.program_days (program_id);
create index program_exercises_program_day_id_idx on public.program_exercises (program_day_id);
create index program_exercises_exercise_id_idx on public.program_exercises (exercise_id);
create index sessions_user_id_session_date_idx on public.sessions (user_id, session_date desc);
create index sessions_program_day_id_idx on public.sessions (program_day_id);
create index session_exercises_session_id_idx on public.session_exercises (session_id);
create index session_exercises_program_exercise_id_idx on public.session_exercises (program_exercise_id);
create index sets_session_exercise_id_idx on public.sets (session_exercise_id);

-- ---------------------------------------------------------------------------
-- Grants
--
-- RLS filters rows, but PostgREST still needs table-level privileges before a
-- policy is ever consulted. The platform's default privileges for new tables
-- hand `authenticated` only Dxtm (truncate/references/trigger/maintain), not
-- CRUD — so without these grants every request fails with
-- "permission denied for table ...", policies notwithstanding.
--
-- Nothing is granted to `anon`: unauthenticated requests are refused at the
-- privilege layer, before RLS, on every table including the shared catalog.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.weight_logs,
  public.categories,
  public.exercises,
  public.programs,
  public.program_days,
  public.program_exercises,
  public.sessions,
  public.session_exercises,
  public.sets
to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- RLS is enabled on every table. Without a matching policy the default is deny,
-- so the anon role has no access anywhere below.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.categories enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets enable row level security;

-- Directly owned tables -----------------------------------------------------

create policy "Users manage their own profile"
  on public.profiles for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users manage their own weight logs"
  on public.weight_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own programs"
  on public.programs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own sessions"
  on public.sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Tables owned via a parent -------------------------------------------------

create policy "Users manage days of their own programs"
  on public.program_days for all to authenticated
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "Users manage exercises of their own program days"
  on public.program_exercises for all to authenticated
  using (
    exists (
      select 1
      from public.program_days pd
      join public.programs p on p.id = pd.program_id
      where pd.id = program_exercises.program_day_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.program_days pd
      join public.programs p on p.id = pd.program_id
      where pd.id = program_exercises.program_day_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "Users manage exercises of their own sessions"
  on public.session_exercises for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_exercises.session_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "Users manage sets of their own sessions"
  on public.sets for all to authenticated
  using (
    exists (
      select 1
      from public.session_exercises se
      join public.sessions s on s.id = se.session_id
      where se.id = sets.session_exercise_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.session_exercises se
      join public.sessions s on s.id = se.session_id
      where se.id = sets.session_exercise_id
        and s.user_id = (select auth.uid())
    )
  );

-- Shared catalog ------------------------------------------------------------
--
-- categories and exercises are shared reference data with no per-row owner.
-- Any authenticated user may read and edit them; anon still gets nothing.

create policy "Authenticated users manage the category catalog"
  on public.categories for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated users manage the exercise catalog"
  on public.exercises for all to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Seed data
--
-- Lives in the migration rather than supabase/seed.sql so that it is applied
-- to the linked project by the GitHub integration; seed.sql only runs on a
-- local `supabase db reset`.
--
-- Category assignment follows AJ's existing split ("Chest & Tri", "Back & Bi"
-- per PRD §2), so triceps sit under Chest and biceps under Back.
--
-- movement_pattern is what drives alternates, so it is deliberately narrower
-- than the category: Chest Flys does not share a pattern with the presses, and
-- so will not be offered as a substitute for one (PRD §8.5).
-- ---------------------------------------------------------------------------

insert into public.categories (name) values
  ('Chest'),
  ('Back'),
  ('Legs'),
  ('Shoulders'),
  ('Core')
on conflict (name) do nothing;

insert into public.exercises (category_id, name, movement_pattern)
select c.id, e.name, e.movement_pattern
from (values
  ('Chest',     'Flat DB Press',             'horizontal push'),
  ('Chest',     'Incline DB Press',          'horizontal push'),
  ('Chest',     'Chest Flys',                'horizontal adduction'),
  ('Chest',     'Tricep Pushdown',           'elbow extension'),
  ('Chest',     'Tricep Overhead Extension', 'elbow extension'),
  ('Back',      'Pull-ups',                  'vertical pull'),
  ('Back',      'Lat Pulldown',              'vertical pull'),
  ('Back',      'Seated Rows',               'horizontal pull'),
  ('Back',      'Preacher Curls',            'elbow flexion'),
  ('Back',      'Cable Hammer Curls',        'elbow flexion'),
  ('Legs',      'Leg Extension',             'knee extension'),
  ('Legs',      'Hamstring Curls',           'knee flexion'),
  ('Shoulders', 'Machine Shoulder Press',    'vertical push'),
  ('Shoulders', 'Lateral Raises',            'shoulder abduction'),
  ('Shoulders', 'Rear Delt Flys',            'horizontal abduction')
) as e (category_name, name, movement_pattern)
join public.categories c on c.name = e.category_name;
