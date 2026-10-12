-- Ezlyfts — one bodyweight entry per user per day.
--
-- weight_logs had no rule against two rows on the same date, and onboarding
-- and the Profile entry both insert. "Current" bodyweight was read as the
-- latest date with ties broken by id, a random UUID, so of two same-day rows
-- the app showed whichever id happened to sort higher — not the one entered
-- last — and BMI used that value.
--
-- After this migration a day holds one row and the last entry of the day wins.
-- Nothing is deleted: rows that would collide are moved to an archive that only
-- the database owner can read.
--
-- Safe to re-run, and safe while the previous build is still serving: its plain
-- inserts keep working (the trigger below replaces that day's row instead of
-- letting the new constraint reject the insert).

-- One transaction, so it applies completely or not at all. (The CLI runs a
-- migration file's statements without wrapping them, so it is explicit here.)
begin;

-- Block concurrent inserts for the few milliseconds this takes, so no new
-- duplicate can land between the de-duplication and the constraint.
lock table public.weight_logs in share row exclusive mode;

-- ---------------------------------------------------------------------------
-- 1. When an entry was made. Existing rows all get the migration time; the
--    column matters from now on, as the tie-break after log_date.
-- ---------------------------------------------------------------------------

alter table public.weight_logs
  add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. The archive: same columns plus archived_at.
--
-- RLS on with no policies, and no privileges for anon or authenticated, so it
-- is invisible to the app and the API (including the service role). Only the
-- table owner — the Supabase dashboard — can read it.
-- ---------------------------------------------------------------------------

create table if not exists public.weight_logs_archive (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  weight numeric not null,
  created_at timestamptz,
  archived_at timestamptz not null default now()
);

alter table public.weight_logs_archive enable row level security;
revoke all on public.weight_logs_archive from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Keep the row the app currently shows for each user and day; archive the
--    rest. "Currently shows" is the old read order: log_date desc, id desc —
--    i.e. the highest id within a day.
-- ---------------------------------------------------------------------------

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, log_date
      order by id desc
    ) as rn
  from public.weight_logs
),
moved as (
  delete from public.weight_logs w
  using ranked r
  where w.id = r.id
    and r.rn > 1
  returning w.id, w.user_id, w.log_date, w.weight, w.created_at
)
insert into public.weight_logs_archive (id, user_id, log_date, weight, created_at)
select id, user_id, log_date, weight, created_at from moved
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. One row per user per day.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weight_logs_user_id_log_date_key'
      and conrelid = 'public.weight_logs'::regclass
  ) then
    alter table public.weight_logs
      add constraint weight_logs_user_id_log_date_key unique (user_id, log_date);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. A new entry for a day replaces that day's entry.
--
-- BEFORE INSERT: delete the caller's existing row for the same date, then let
-- the insert through unchanged. Deliberately not "update the old row and
-- return NULL": a skipped insert returns no row, so an insert(...).select()
-- would come back empty and the caller would report a failure for a save that
-- happened.
--
-- SECURITY INVOKER, so the delete is subject to the caller's RLS ("Users
-- manage their own weight logs", FOR ALL): it can only ever remove the
-- caller's own row. An insert claiming someone else's user_id deletes nothing
-- and is then refused by the policy's WITH CHECK.
--
-- The app upserts on (user_id, log_date) as well; with this trigger the
-- conflict never arises, but the upsert keeps the intent explicit.
-- ---------------------------------------------------------------------------

create or replace function public.weight_logs_replace_same_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.weight_logs
   where user_id = new.user_id
     and log_date = new.log_date
     and id <> new.id;
  return new;
end;
$$;

revoke all on function public.weight_logs_replace_same_day()
  from public, anon, authenticated, service_role;

drop trigger if exists weight_logs_replace_same_day on public.weight_logs;
create trigger weight_logs_replace_same_day
  before insert on public.weight_logs
  for each row execute function public.weight_logs_replace_same_day();

commit;
