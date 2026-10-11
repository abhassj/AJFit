-- AJFit v2 (Ezlyfts) — logged history no longer pins the Split.
--
-- Until now session_exercises.program_exercise_id was NOT NULL and ON DELETE
-- RESTRICT: an exercise you had ever logged could never be removed from your
-- Split, because the log row held the slot hostage. With the exercise_id
-- snapshot (20261010120000) the log already knows what was performed, so the
-- slot link becomes optional history: removing the slot clears it, and the
-- log stands on its own.
--
-- Safe while the previous build serves: it never relied on the slot being
-- present for reads (it falls back when the embed is null), it still inserts
-- with a slot (the trigger fills the new snapshot columns), and its Split
-- editor still refuses removals on its own, so nothing changes for it.
--
-- Also in this migration, as one concern ("who may point at what"):
--   - RLS: a session_exercise may only reference a slot the caller owns.
--   - The catalog loses REFERENCES and TRIGGER for authenticated.

-- ---------------------------------------------------------------------------
-- 1. Snapshot the slot's display fields onto the log row
--
-- Order and prescribed reps are part of what was logged ("3x10, second
-- exercise of the day"), so they are copied at log time rather than read live
-- from a slot that may since have changed or gone. rest_seconds is NOT
-- copied: it only drives the live rest timer, which reads the current slot.
-- ---------------------------------------------------------------------------

alter table public.session_exercises
  add column exercise_order int,
  add column prescribed_reps text;

update public.session_exercises se
set exercise_order = pe.exercise_order,
    prescribed_reps = pe.prescribed_reps
from public.program_exercises pe
where pe.id = se.program_exercise_id
  and se.exercise_order is null;

-- Fills every snapshot column the insert left null, from the slot. Replaces
-- the exercise_id-only version; still SECURITY INVOKER, so the slot lookup is
-- subject to the caller's RLS.
create or replace function public.session_exercises_fill_exercise_id()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slot record;
begin
  if new.program_exercise_id is not null
     and (new.exercise_id is null or new.exercise_order is null) then
    select pe.exercise_id, pe.exercise_order, pe.prescribed_reps
      into slot
      from public.program_exercises pe
     where pe.id = new.program_exercise_id;

    if found then
      if new.exercise_id is null then
        new.exercise_id := slot.exercise_id;
      end if;
      if new.exercise_order is null then
        new.exercise_order := slot.exercise_order;
        new.prescribed_reps := coalesce(new.prescribed_reps, slot.prescribed_reps);
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.session_exercises_fill_exercise_id()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The slot link becomes optional: ON DELETE SET NULL
-- ---------------------------------------------------------------------------

alter table public.session_exercises
  alter column program_exercise_id drop not null;

alter table public.session_exercises
  drop constraint session_exercises_program_exercise_id_fkey;

alter table public.session_exercises
  add constraint session_exercises_program_exercise_id_fkey
  foreign key (program_exercise_id)
  references public.program_exercises (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 3. RLS: a log row may only point at the caller's own slot
--
-- The old policy checked who owned the SESSION and nothing else, so a row in
-- B's own session could reference one of A's slots. Slot ids are random and
-- never shown to another user, but such a row would have pinned A's slot
-- (RESTRICT) and now would silently tie A's template into B's log. USING is
-- unchanged — reading, updating and deleting your own rows is about the
-- session — while WITH CHECK adds the slot rule for every insert and update.
-- ---------------------------------------------------------------------------

drop policy "Users manage exercises of their own sessions"
  on public.session_exercises;

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
    and (
      session_exercises.program_exercise_id is null
      or exists (
        select 1
        from public.program_exercises pe
        join public.program_days pd on pd.id = pe.program_day_id
        join public.programs p on p.id = pd.program_id
        where pe.id = session_exercises.program_exercise_id
          and p.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Catalog: no latent DDL privileges either
--
-- 20260814201343 removed every write privilege on the catalog; REFERENCES and
-- TRIGGER came from the platform's default grants. Neither is reachable
-- through the API, but the catalog is meant to be SELECT-only, full stop.
-- ---------------------------------------------------------------------------

revoke references, trigger on
  public.categories,
  public.subcategories,
  public.exercises
from authenticated;
