-- AJFit v2 (Ezlyfts) — Phase 0, migration B: single-arm (unilateral) Arms work.
--
-- Added to the existing Arms subcategories rather than a new "Unilateral"
-- group (D11): a subcategory carries one target_muscle and one how_to_perform,
-- and a mixed biceps/triceps group would have neither. One logged set is one
-- round of both sides; left/right tagging is out of scope for v2.
--
-- Idempotent: re-running inserts nothing.

insert into public.exercises (subcategory_id, name)
select sc.id, e.name
from (values
  ('Standard & Short-Head Bicep Variations', 'Single-Arm Cable Curl'),
  ('Standard & Short-Head Bicep Variations', 'Single-Arm Preacher Curl'),
  ('Standard & Short-Head Bicep Variations', 'Concentration Curl'),
  ('Neutral / Hammer Curl Variations', 'Single-Arm Cable Hammer Curl'),
  ('Neutral / Hammer Curl Variations', 'Cross-Body Hammer Curl'),
  ('Tricep Pushdown Variations', 'Single-Arm Cable Pushdown'),
  ('Tricep Pushdown Variations', 'Single-Arm Reverse-Grip Pushdown'),
  ('Tricep Extension Variations', 'Single-Arm Cable Tricep Extension'),
  ('Tricep Extension Variations', 'Single-Arm Overhead Cable Extension'),
  ('Tricep Extension Variations', 'Single-Arm Overhead Dumbbell Extension'),
  ('Tricep Extension Variations', 'Dumbbell Tricep Kickback')
) as e (subcategory_name, name)
join public.categories c on c.name = 'Arms'
join public.subcategories sc
  on sc.category_id = c.id
 and sc.name = e.subcategory_name
on conflict (subcategory_id, name) do nothing;
