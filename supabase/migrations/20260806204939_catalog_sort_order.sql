-- AJFit — catalog display ordering.
--
-- The catalog tables had no ordering column, so display order lived in a
-- hardcoded array in src/lib/catalog.ts and Postgres was free to return rows in
-- any order. This moves ordering into the data.
--
-- Backfill:
--   categories    — the exact order previously hardcoded as CATEGORY_ORDER.
--   subcategories — the authoring order from AJ's Gym Exercise Library, which
--                   runs from the primary compound pattern out to isolation
--                   work (Flat Press -> Incline -> Decline -> Isolation).
--                   Subcategories had no hardcoded order to preserve; they were
--                   sorted alphabetically purely so the output was
--                   deterministic, which is not a display decision.

alter table public.categories
  add column sort_order int not null default 0;

alter table public.subcategories
  add column sort_order int not null default 0;

-- Categories -----------------------------------------------------------------

update public.categories c
set sort_order = v.sort_order
from (values
  ('Chest', 1),
  ('Back', 2),
  ('Shoulders', 3),
  ('Legs', 4),
  ('Arms', 5),
  ('Abs & Core', 6)
) as v (name, sort_order)
where c.name = v.name;

-- Subcategories --------------------------------------------------------------

update public.subcategories s
set sort_order = v.sort_order
from (values
  ('Chest', 'Flat Press Variations', 1),
  ('Chest', 'Incline Press Variations', 2),
  ('Chest', 'Decline & Dip Variations', 3),
  ('Chest', 'Chest Isolation & Flye Variations', 4),

  ('Back', 'Vertical Pull Variations', 1),
  ('Back', 'Horizontal Mid-Back Row Variations', 2),
  ('Back', 'Single-Arm & Unilateral Row Variations', 3),
  ('Back', 'Hinge & Lower Back Movements', 4),

  ('Shoulders', 'Overhead Press Variations', 1),
  ('Shoulders', 'Lateral Raise Variations', 2),
  ('Shoulders', 'Rear Delt & Face Pull Variations', 3),
  ('Shoulders', 'Front Raise Variations', 4),

  ('Legs', 'Squat & Compound Press Variations', 1),
  ('Legs', 'Lunge & Unilateral Variations', 2),
  ('Legs', 'Hamstring Hinge & Curl Variations', 3),
  ('Legs', 'Quad Isolation Variations', 4),
  ('Legs', 'Calf Raise Variations', 5),

  ('Arms', 'Standard & Short-Head Bicep Variations', 1),
  ('Arms', 'Neutral / Hammer Curl Variations', 2),
  ('Arms', 'Stretched Bicep Curl Variations', 3),
  ('Arms', 'Tricep Pushdown Variations', 4),
  ('Arms', 'Tricep Extension Variations', 5),

  ('Abs & Core', 'Lower Ab / Leg Raise Variations', 1),
  ('Abs & Core', 'Weighted Crunch Variations', 2),
  ('Abs & Core', 'Oblique & Rotational Variations', 3),
  ('Abs & Core', 'Rollout & Stability Variations', 4)
) as v (category_name, name, sort_order)
where s.name = v.name
  and s.category_id = (
    select id from public.categories where name = v.category_name
  );

-- Ordering is the access pattern for both tables, so index it alongside the
-- parent key rather than leaving a sort on every catalog read.
create index categories_sort_order_idx on public.categories (sort_order);
create index subcategories_category_id_sort_order_idx
  on public.subcategories (category_id, sort_order);
