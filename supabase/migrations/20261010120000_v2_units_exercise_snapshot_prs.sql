-- AJFit v2 (Ezlyfts) — Phase 0, migration A: schema groundwork.
--
-- Three concerns, all additive and safe while the previous app build is still
-- serving (migrations apply on push; the app deploys separately):
--
--   1. profiles: unit preferences, height and an onboarding marker.
--   2. session_exercises.exercise_id: a snapshot of which catalog exercise was
--      actually performed, so editing a program slot can never rewrite history.
--   3. exercise_prs(): personal records, read through RLS.

-- ---------------------------------------------------------------------------
-- 1. profiles
--
-- The database always stores kilograms and centimetres (decision D1). These
-- columns only decide how numbers are entered and displayed, so flipping a
-- preference never converts — and never slowly rounds away — stored history.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column weight_unit text not null default 'kg'
    constraint profiles_weight_unit_check check (weight_unit in ('kg', 'lbs')),
  add column height_unit text not null default 'cm'
    constraint profiles_height_unit_check check (height_unit in ('cm', 'ft')),
  -- 50–272 cm brackets every recorded adult height with room either side.
  add column height_cm numeric
    constraint profiles_height_cm_check check (height_cm is null or height_cm between 50 and 272),
  -- Null until the onboarding form is completed; drives the one-time prompt.
  add column onboarded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. session_exercises.exercise_id
--
-- A log row used to reach its exercise only through program_exercise_id, i.e.
-- through the *current* contents of a program slot. Swapping that slot from
-- Flat DB Press to Incline DB Press silently turned every old Flat set into an
-- Incline set, which would corrupt PRs. The snapshot fixes that from here on.
--
-- Backfill assumption, stated plainly: each existing log is attributed to its
-- slot's current exercise. That is the best information available for the
-- past and is exactly what the app displayed until now.
-- ---------------------------------------------------------------------------

alter table public.session_exercises
  add column exercise_id uuid references public.exercises (id) on delete restrict;

update public.session_exercises se
set exercise_id = pe.exercise_id
from public.program_exercises pe
where pe.id = se.program_exercise_id
  and se.exercise_id is null;

/*
 * Fills exercise_id from the slot when an insert does not supply it.
 *
 * This is what makes the deploy order safe: the previous app build keeps
 * inserting session_exercises without the new column for as long as it is
 * still serving, and every one of those rows is still stamped correctly. It
 * also covers the Start and backfill flows without either having to change.
 *
 * SECURITY INVOKER (the default): the lookup runs as the inserting user, so it
 * can only see a slot that RLS already lets that user see — and an insert
 * against someone else's slot fails here rather than leaking anything.
 */
create function public.session_exercises_fill_exercise_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exercise_id is null then
    select pe.exercise_id
      into new.exercise_id
      from public.program_exercises pe
     where pe.id = new.program_exercise_id;
  end if;
  return new;
end;
$$;

revoke all on function public.session_exercises_fill_exercise_id() from public, anon, authenticated, service_role;

create trigger session_exercises_fill_exercise_id
  before insert on public.session_exercises
  for each row execute function public.session_exercises_fill_exercise_id();

alter table public.session_exercises
  alter column exercise_id set not null;

create index session_exercises_exercise_id_idx
  on public.session_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- 3. exercise_prs()
--
-- A personal record is the heaviest weight in any set of a *completed*
-- session (D4). Ties go to more reps, then the earliest date — the first time
-- you hit it is when you set it.
--
-- Records are keyed by exercise *name*, not row id (D5): Romanian Deadlift is
-- catalogued under both Back and Legs as two rows, and one lift should have one
-- PR. Each record is then reported once per category that lists the name, so
-- the PR page can show it under both with the same value.
--
-- Weights are kilograms; the caller converts for display. Null and zero
-- weights are excluded, so bodyweight-only work never shows "PR 0 kg".
--
-- SECURITY INVOKER so RLS applies: a caller only ever ranks their own sets.
-- The explicit user_id filter is for the planner (it walks the
-- sessions_user_id_session_date index), not for security.
--
--   p_names            only these exercise names (null = all)
--   p_exclude_session  ignore one session, e.g. the one being logged now, so
--                      "PR" beside an exercise means the record coming in
-- ---------------------------------------------------------------------------

create function public.exercise_prs(
  p_names text[] default null,
  p_exclude_session uuid default null
)
returns table (
  exercise_name text,
  category_name text,
  category_sort_order int,
  weight_kg numeric,
  reps int,
  achieved_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      e.name as exercise_name,
      st.weight,
      st.reps_done,
      s.session_date,
      row_number() over (
        partition by e.name
        order by st.weight desc, st.reps_done desc nulls last, s.session_date asc
      ) as rn
    from public.sets st
    join public.session_exercises se on se.id = st.session_exercise_id
    join public.sessions s on s.id = se.session_id
    join public.exercises e on e.id = se.exercise_id
    where s.user_id = (select auth.uid())
      and s.status = 'completed'
      and st.weight is not null
      and st.weight > 0
      and (p_names is null or e.name = any (p_names))
      and (p_exclude_session is null or s.id <> p_exclude_session)
  )
  select distinct
    r.exercise_name,
    c.name,
    c.sort_order,
    r.weight,
    r.reps_done,
    r.session_date
  from ranked r
  join public.exercises e2 on e2.name = r.exercise_name
  join public.subcategories sc on sc.id = e2.subcategory_id
  join public.categories c on c.id = sc.category_id
  where r.rn = 1
  order by c.sort_order, r.exercise_name;
$$;

-- Functions are executable by PUBLIC by default, and the platform's default
-- privileges also hand new functions to anon and service_role. Only signed-in
-- users call this, through RLS, so it is granted to authenticated alone.
revoke all on function public.exercise_prs(text[], uuid) from public, anon, service_role;
grant execute on function public.exercise_prs(text[], uuid) to authenticated;
