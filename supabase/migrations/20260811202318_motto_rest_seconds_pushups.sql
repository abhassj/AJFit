-- AJFit — profile motto, per-exercise rest timers, and one catalog addition.

-- ---------------------------------------------------------------------------
-- profiles.bio -> profiles.motto
--
-- A rename rather than a new column: this replaces the free-text bio with a
-- short tagline. Renaming carries any existing text across instead of
-- stranding it in a dropped column.
-- ---------------------------------------------------------------------------

alter table public.profiles rename column bio to motto;

-- ---------------------------------------------------------------------------
-- program_exercises.rest_seconds
--
-- Nullable on purpose, and deliberately left without a default. Null means
-- "no rest timer for this exercise", which is a real choice — guessing a
-- default would silently offer a rest period the user never asked for.
-- ---------------------------------------------------------------------------

alter table public.program_exercises
  add column rest_seconds int;

comment on column public.program_exercises.rest_seconds is
  'Rest period in seconds. NULL means no rest timer is offered for this exercise.';

-- ---------------------------------------------------------------------------
-- Catalog: Push-Ups
--
-- Joins the existing Chest > Flat Press Variations group, so it inherits that
-- subcategory's target_muscle and how_to_perform unchanged — the whole point of
-- the three-level hierarchy (PRD §8).
-- ---------------------------------------------------------------------------

insert into public.exercises (subcategory_id, name)
select s.id, 'Push-Ups'
from public.subcategories s
join public.categories c on c.id = s.category_id
where c.name = 'Chest'
  and s.name = 'Flat Press Variations'
on conflict (subcategory_id, name) do nothing;
