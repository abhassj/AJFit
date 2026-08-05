-- AJFit — Phase 1: core schema, row level security, and catalog seed data.
--
-- The schema is split in two halves (see PRD §7):
--   template — programs / program_days / program_exercises, the reusable plan
--   log      — sessions / session_exercises / sets, dated records of what
--              actually happened
--
-- The exercise catalog is a three-level hierarchy:
--   categories -> subcategories -> exercises
-- Technique guidance (target_muscle, how_to_perform) lives on the subcategory,
-- so every exercise in a group shares one description rather than repeating it.
-- The subcategory also replaces the movement_pattern column and any alternates
-- junction table: exercises sharing a subcategory ARE each other's alternates.
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

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null,
  target_muscle text not null,
  how_to_perform text not null,
  unique (category_id, name)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.subcategories (id) on delete restrict,
  name text not null,
  unique (subcategory_id, name)
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
create index subcategories_category_id_idx on public.subcategories (category_id);
create index exercises_subcategory_id_idx on public.exercises (subcategory_id);
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
  public.subcategories,
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
alter table public.subcategories enable row level security;
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
-- categories, subcategories and exercises are shared reference data with no
-- per-row owner. Any authenticated user may read and edit them; anon still
-- gets nothing.

create policy "Authenticated users manage the category catalog"
  on public.categories for all to authenticated
  using (true)
  with check (true);

create policy "Authenticated users manage the subcategory catalog"
  on public.subcategories for all to authenticated
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
-- 6 categories -> 26 subcategories -> 86 exercises.
--
-- Note that some exercise names recur across subcategories on purpose, e.g.
-- "Romanian Deadlift (RDL)" appears under both Back > Hinge & Lower Back
-- Movements and Legs > Hamstring Hinge & Curl Variations. The uniqueness
-- constraint is (subcategory_id, name), so the same movement can be catalogued
-- under each muscle group it trains.
-- ---------------------------------------------------------------------------

insert into public.categories (name) values
  ('Chest'),
  ('Back'),
  ('Shoulders'),
  ('Legs'),
  ('Arms'),
  ('Abs & Core');

insert into public.subcategories (category_id, name, target_muscle, how_to_perform)
select c.id, s.name, s.target_muscle, s.how_to_perform
from (values
  ('Chest', 'Flat Press Variations',
   'Mid-Pectoralis Major, Anterior Deltoids, Triceps Brachii',
   'Lie flat on bench, retract scapula. Grip bar or dumbbells slightly wider than shoulder-width. Lower weight controlled to mid-chest keeping elbows at ~45–60 degrees. Press upward to starting position without unlocking shoulders.'),
  ('Chest', 'Incline Press Variations',
   'Upper Chest (Clavicular Head), Anterior Deltoids',
   'Set bench to a 30–45 degree incline. Hold dumbbells or bar at upper chest level with wrists neutral. Press weight upward until arms are extended, squeeze upper chest at top, lower under control.'),
  ('Chest', 'Decline & Dip Variations',
   'Lower Chest (Sternal Head), Triceps Brachii',
   'Position bench at 15–30 degree decline or lean torso forward ~30 degrees on dip bars. Lower weight or body toward lower chest, drive upward focusing on lower chest contraction.'),
  ('Chest', 'Chest Isolation & Flye Variations',
   'Pectoralis Major (Isolation / Peak Contraction)',
   'Set pulleys or machine handles at shoulder height. Keeping a slight, rigid bend in elbows, bring hands together in a sweeping arc. Squeeze chest at peak contraction, control the stretch back.'),

  ('Back', 'Vertical Pull Variations',
   'Latissimus Dorsi, Teres Major, Biceps',
   'Grip bar slightly wider than shoulder-width. Sit tall with thighs locked. Lean back slightly, pull bar down toward upper chest bringing elbows down and back. Control the return stretch.'),
  ('Back', 'Horizontal Mid-Back Row Variations',
   'Rhomboids, Middle Trapezius, Mid-Lats',
   'Hinge at hips with knees slightly bent and torso leaning forward. Pull weight toward belly button, driving elbows past torso while fully squeezing shoulder blades together.'),
  ('Back', 'Single-Arm & Unilateral Row Variations',
   'Lats, Upper Back, Core Stability',
   'Support body on bench or machine pad. Hold weight in free hand, drive elbow upward toward hip while squeezing lat at top. Lower fully for deep stretch.'),
  ('Back', 'Hinge & Lower Back Movements',
   'Erector Spinae, Glutes, Hamstrings, Full Posterior Chain',
   'Stand with feet hip-width apart or secure legs on hyperextension bench. Hinge down at hips keeping spine neutral. Drive through floor or extend hips upward to align torso with lower body.'),

  ('Shoulders', 'Overhead Press Variations',
   'Anterior Deltoid, Lateral Deltoid, Triceps',
   'Seated or standing, hold weight at upper chest level. Brace core, press weight overhead until arms fully extend. Lower in a controlled motion to chin/chest level.'),
  ('Shoulders', 'Lateral Raise Variations',
   'Lateral (Side) Deltoid',
   'Stand or sit with neutral grip. With elbows slightly bent, raise arms out to sides until parallel with floor, leading with elbows. Lower weight slowly.'),
  ('Shoulders', 'Rear Delt & Face Pull Variations',
   'Rear Deltoid, Rotator Cuff, Upper Traps',
   'Attach rope to high pulley or use machine handles. Pull backward toward forehead/eyes, flaring elbows and rotating shoulders outward at peak contraction.'),
  ('Shoulders', 'Front Raise Variations',
   'Anterior (Front) Deltoid',
   'Hold weight with overhand grip at thighs. Keeping arms straight with soft elbows, raise weight forward up to shoulder level. Control descent.'),

  ('Legs', 'Squat & Compound Press Variations',
   'Quadriceps, Gluteus Maximus, Adductors',
   'Position feet shoulder-width. Hinge at hips and bend knees, lowering body until thighs are parallel to floor or lower. Drive upward evenly through mid-foot.'),
  ('Legs', 'Lunge & Unilateral Variations',
   'Quadriceps, Glutes, Calves, Core Balance',
   'Step forward or elevate rear foot. Lower hips until front knee is bent at 90 degrees. Drive through front heel to return to standing or stride forward.'),
  ('Legs', 'Hamstring Hinge & Curl Variations',
   'Hamstrings, Gluteus Maximus',
   'Flex knees to pull pad toward glutes on machine, or hinge backward pushing hips out while lowering weight along shins until hamstring stretch is felt.'),
  ('Legs', 'Quad Isolation Variations',
   'Quadriceps (Rectus Femoris Isolation)',
   'Sit on machine with pad across lower shins. Extend knees to raise legs until fully extended, contract quads forcefully at top, lower under control.'),
  ('Legs', 'Calf Raise Variations',
   'Gastrocnemius, Soleus',
   'Place balls of feet on platform edge. Lower heels down for deep stretch, then extend ankles upward onto toes as high as possible. Pause at peak contraction.'),

  ('Arms', 'Standard & Short-Head Bicep Variations',
   'Biceps Brachii (Both Heads / Short Head Peak)',
   'Rest upper arms firmly on preacher pad or stand tall. Pin elbows, curl weight upward toward shoulders by flexing biceps. Lower smoothly to full stretch without locking out abruptly.'),
  ('Arms', 'Neutral / Hammer Curl Variations',
   'Brachialis, Brachioradialis (Forearms), Biceps',
   'Hold dumbbells or rope attachment with neutral grip (palms facing each other). Keeping upper arm stationary, curl weight toward shoulders.'),
  ('Arms', 'Stretched Bicep Curl Variations',
   'Long Head of Biceps (Stretch Focus)',
   'Stand facing away from low cable stack with cable held behind body or sit on incline bench. Let arms hang back behind torso. Curl weight forward/upward while keeping upper arm behind shoulder line to maximize stretch.'),
  ('Arms', 'Tricep Pushdown Variations',
   'Lateral & Medial Heads of Triceps',
   'Attach rope or bar to high pulley. Keep upper arms pinned to sides. Push weight down, fully extending elbows at bottom. Control return.'),
  ('Arms', 'Tricep Extension Variations',
   'Long & Lateral Heads of Triceps',
   'Hold weight overhead or lying on bench. Hinge at elbows, lowering weight behind head or toward forehead, then press back to full arm extension.'),

  ('Abs & Core', 'Lower Ab / Leg Raise Variations',
   'Lower Rectus Abdominis, Hip Flexors',
   'Hang from bar or lie on back. Flex abs and raise knees or legs toward chest level without using momentum. Lower with control.'),
  ('Abs & Core', 'Weighted Crunch Variations',
   'Upper & Mid Rectus Abdominis',
   'Kneel or sit holding weight/rope. Flex spine downward bringing chest toward knees, squeezing abs forcefully at bottom contraction.'),
  ('Abs & Core', 'Oblique & Rotational Variations',
   'Obliques, Rotational Core Stability',
   'Sit with knees bent or stand at cable machine. Lean torso slightly back or brace core, rotating torso from side to side in controlled manner.'),
  ('Abs & Core', 'Rollout & Stability Variations',
   'Deep Core, Transverse Abdominis',
   'Kneel holding wheel or ball. Roll forward, extending body flat without sagging lower back. Pull back using core muscles to return to start.')
) as s (category_name, name, target_muscle, how_to_perform)
join public.categories c on c.name = s.category_name;

insert into public.exercises (subcategory_id, name)
select sc.id, e.name
from (values
  ('Chest', 'Flat Press Variations', 'Barbell Bench Press'),
  ('Chest', 'Flat Press Variations', 'Flat Dumbbell Press'),
  ('Chest', 'Flat Press Variations', 'Flat Machine Chest Press'),
  ('Chest', 'Incline Press Variations', 'Incline Barbell Press'),
  ('Chest', 'Incline Press Variations', 'Incline Dumbbell Press'),
  ('Chest', 'Incline Press Variations', 'Incline Machine Press'),
  ('Chest', 'Decline & Dip Variations', 'Decline Barbell Press'),
  ('Chest', 'Decline & Dip Variations', 'Decline Dumbbell Press'),
  ('Chest', 'Decline & Dip Variations', 'Chest Dips'),
  ('Chest', 'Decline & Dip Variations', 'Lower Chest Machine Press'),
  ('Chest', 'Chest Isolation & Flye Variations', 'Cable Chest Flye / Crossover'),
  ('Chest', 'Chest Isolation & Flye Variations', 'Pec Deck Flye Machine'),
  ('Chest', 'Chest Isolation & Flye Variations', 'Dumbbell Chest Flye'),

  ('Back', 'Vertical Pull Variations', 'Lat Pulldown'),
  ('Back', 'Vertical Pull Variations', 'Pull-ups / Chin-ups'),
  ('Back', 'Vertical Pull Variations', 'Neutral-Grip Cable Pulldown'),
  ('Back', 'Horizontal Mid-Back Row Variations', 'Barbell Bent-Over Row'),
  ('Back', 'Horizontal Mid-Back Row Variations', 'Seated Cable Row'),
  ('Back', 'Horizontal Mid-Back Row Variations', 'Machine Seated Row'),
  ('Back', 'Single-Arm & Unilateral Row Variations', 'Single-Arm Dumbbell Row'),
  ('Back', 'Single-Arm & Unilateral Row Variations', 'Meadows Row'),
  ('Back', 'Single-Arm & Unilateral Row Variations', 'Supported Chest T-Bar Row'),
  ('Back', 'Hinge & Lower Back Movements', 'Conventional Deadlift'),
  ('Back', 'Hinge & Lower Back Movements', 'Romanian Deadlift (RDL)'),
  ('Back', 'Hinge & Lower Back Movements', 'Trap Bar Deadlift'),
  ('Back', 'Hinge & Lower Back Movements', 'Back Extensions (Hyperextensions)'),

  ('Shoulders', 'Overhead Press Variations', 'Overhead Barbell Press'),
  ('Shoulders', 'Overhead Press Variations', 'Seated Dumbbell Press'),
  ('Shoulders', 'Overhead Press Variations', 'Arnold Press'),
  ('Shoulders', 'Overhead Press Variations', 'Machine Press'),
  ('Shoulders', 'Lateral Raise Variations', 'Dumbbell Lateral Raise'),
  ('Shoulders', 'Lateral Raise Variations', 'Cable Lateral Raise'),
  ('Shoulders', 'Lateral Raise Variations', 'Machine Lateral Raise'),
  ('Shoulders', 'Rear Delt & Face Pull Variations', 'Cable Face Pulls'),
  ('Shoulders', 'Rear Delt & Face Pull Variations', 'Reverse Pec Deck Flye'),
  ('Shoulders', 'Rear Delt & Face Pull Variations', 'Bent-Over Rear Delt Flye'),
  ('Shoulders', 'Front Raise Variations', 'Barbell Front Raise'),
  ('Shoulders', 'Front Raise Variations', 'Dumbbell Front Raise'),
  ('Shoulders', 'Front Raise Variations', 'Plate Front Raise'),
  ('Shoulders', 'Front Raise Variations', 'Cable Front Raise'),

  ('Legs', 'Squat & Compound Press Variations', 'Barbell Back Squat'),
  ('Legs', 'Squat & Compound Press Variations', 'Barbell Front Squat'),
  ('Legs', 'Squat & Compound Press Variations', 'Leg Press'),
  ('Legs', 'Squat & Compound Press Variations', 'Hack Squat'),
  ('Legs', 'Squat & Compound Press Variations', 'Goblet Squat'),
  ('Legs', 'Lunge & Unilateral Variations', 'Walking Lunges'),
  ('Legs', 'Lunge & Unilateral Variations', 'Bulgarian Split Squat'),
  ('Legs', 'Lunge & Unilateral Variations', 'Step-ups'),
  ('Legs', 'Hamstring Hinge & Curl Variations', 'Romanian Deadlift (RDL)'),
  ('Legs', 'Hamstring Hinge & Curl Variations', 'Lying Leg Curl'),
  ('Legs', 'Hamstring Hinge & Curl Variations', 'Seated Leg Curl'),
  ('Legs', 'Quad Isolation Variations', 'Leg Extension'),
  ('Legs', 'Quad Isolation Variations', 'Sissy Squat'),
  ('Legs', 'Quad Isolation Variations', 'Cyclist Squat'),
  ('Legs', 'Calf Raise Variations', 'Standing Calf Raise'),
  ('Legs', 'Calf Raise Variations', 'Seated Calf Raise'),
  ('Legs', 'Calf Raise Variations', 'Leg Press Calf Press'),

  ('Arms', 'Standard & Short-Head Bicep Variations', 'Barbell Bicep Curl'),
  ('Arms', 'Standard & Short-Head Bicep Variations', 'Dumbbell Bicep Curl'),
  ('Arms', 'Standard & Short-Head Bicep Variations', 'Cable Bicep Curl'),
  ('Arms', 'Standard & Short-Head Bicep Variations', 'Preacher Curls (EZ-Bar / Machine)'),
  ('Arms', 'Neutral / Hammer Curl Variations', 'Dumbbell Hammer Curl'),
  ('Arms', 'Neutral / Hammer Curl Variations', 'Rope Cable Curl'),
  ('Arms', 'Neutral / Hammer Curl Variations', 'Incline Neutral Curl'),
  ('Arms', 'Stretched Bicep Curl Variations', 'Incline Dumbbell Curl'),
  ('Arms', 'Stretched Bicep Curl Variations', 'Behind-the-Back Cable Curl'),
  ('Arms', 'Stretched Bicep Curl Variations', 'Bayesian Cable Curls'),
  ('Arms', 'Tricep Pushdown Variations', 'Tricep Rope Pushdown'),
  ('Arms', 'Tricep Pushdown Variations', 'Straight Bar Pushdown'),
  ('Arms', 'Tricep Pushdown Variations', 'Parallel Bar Dips'),
  ('Arms', 'Tricep Extension Variations', 'Skullcrushers (EZ-Bar)'),
  ('Arms', 'Tricep Extension Variations', 'Overhead Dumbbell Extension'),
  ('Arms', 'Tricep Extension Variations', 'Cable Overhead Extension'),

  ('Abs & Core', 'Lower Ab / Leg Raise Variations', 'Hanging Leg Raise'),
  ('Abs & Core', 'Lower Ab / Leg Raise Variations', 'Hanging Knee Raise'),
  ('Abs & Core', 'Lower Ab / Leg Raise Variations', 'Reverse Crunch'),
  ('Abs & Core', 'Lower Ab / Leg Raise Variations', 'Lying Leg Raise'),
  ('Abs & Core', 'Weighted Crunch Variations', 'Cable Abdominal Crunch'),
  ('Abs & Core', 'Weighted Crunch Variations', 'Decline Abdominal Crunch'),
  ('Abs & Core', 'Weighted Crunch Variations', 'Machine Crunch'),
  ('Abs & Core', 'Oblique & Rotational Variations', 'Russian Twist'),
  ('Abs & Core', 'Oblique & Rotational Variations', 'Cable Woodchoppers'),
  ('Abs & Core', 'Oblique & Rotational Variations', 'Side Plank Cable Row'),
  ('Abs & Core', 'Rollout & Stability Variations', 'Ab Wheel Rollout'),
  ('Abs & Core', 'Rollout & Stability Variations', 'Swiss Ball Rollout'),
  ('Abs & Core', 'Rollout & Stability Variations', 'Hollow Body Hold')
) as e (category_name, subcategory_name, name)
join public.categories c on c.name = e.category_name
join public.subcategories sc
  on sc.category_id = c.id
 and sc.name = e.subcategory_name;
