-- Ezlyfts — personal records for exercises logged without weight.
--
-- The rule (reverses V2's "max-reps PRs out of scope", at the owner's request):
--   a) Any set with weight > 0 in a completed session → a WEIGHT record, as
--      before: heaviest, ties to more reps, then the earliest date.
--   b) Otherwise, sets with reps and no weight (null or 0) → a REPS record:
--      most reps in one set, ties to the earliest date.
--   c) Otherwise no record.
--
-- Backward compatible with the build serving while this deploys:
--   - Same name, same parameters (now with a third, defaulted one), same six
--     columns in the same order, plus one new column, pr_kind.
--   - Reps records are returned ONLY when the caller asks (p_include_reps).
--     The live build calls exercise_prs() / exercise_prs(p_names,
--     p_exclude_session) and maps weight_kg with Number(); a reps row with a
--     null weight would read as "PR 0 kg" there. It never receives one.
--   - SECURITY INVOKER (RLS applies), search_path pinned, EXECUTE for
--     authenticated only.
--
-- The return type changes, so the function is dropped and recreated; one
-- transaction keeps that atomic, and the closing NOTIFY makes PostgREST pick up
-- the new signature at once. Safe to re-run.

begin;

drop function if exists public.exercise_prs(text[], uuid);
drop function if exists public.exercise_prs(text[], uuid, boolean);

create function public.exercise_prs(
  p_names text[] default null,
  p_exclude_session uuid default null,
  p_include_reps boolean default false
)
returns table (
  exercise_name text,
  category_name text,
  category_sort_order int,
  weight_kg numeric,
  reps int,
  achieved_on date,
  pr_kind text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with done as (
    select e.name as exercise_name, st.weight, st.reps_done, s.session_date
    from public.sets st
    join public.session_exercises se on se.id = st.session_exercise_id
    join public.sessions s on s.id = se.session_id
    join public.exercises e on e.id = se.exercise_id
    where s.user_id = (select auth.uid())
      and s.status = 'completed'
      and (p_names is null or e.name = any (p_names))
      and (p_exclude_session is null or s.id <> p_exclude_session)
  ),
  weighted as (
    select
      exercise_name,
      weight,
      reps_done,
      session_date,
      row_number() over (
        partition by exercise_name
        order by weight desc, reps_done desc nulls last, session_date asc
      ) as rn
    from done
    where weight is not null and weight > 0
  ),
  reps_only as (
    select
      d.exercise_name,
      d.reps_done,
      d.session_date,
      row_number() over (
        partition by d.exercise_name
        order by d.reps_done desc, d.session_date asc
      ) as rn
    from done d
    where p_include_reps
      and (d.weight is null or d.weight = 0)
      and d.reps_done is not null
      and d.reps_done > 0
      -- (a) wins: any weighted set means this is a weight record.
      and not exists (
        select 1 from weighted w where w.exercise_name = d.exercise_name
      )
  ),
  best as (
    select exercise_name, weight, reps_done, session_date, 'weight' as kind
    from weighted where rn = 1
    union all
    select exercise_name, null::numeric, reps_done, session_date, 'reps'
    from reps_only where rn = 1
  )
  select distinct
    b.exercise_name,
    c.name,
    c.sort_order,
    b.weight,
    b.reps_done,
    b.session_date,
    b.kind
  from best b
  join public.exercises e2 on e2.name = b.exercise_name
  join public.subcategories sc on sc.id = e2.subcategory_id
  join public.categories c on c.id = sc.category_id
  order by c.sort_order, b.exercise_name;
$$;

revoke all on function public.exercise_prs(text[], uuid, boolean)
  from public, anon, service_role;
grant execute on function public.exercise_prs(text[], uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';

commit;
