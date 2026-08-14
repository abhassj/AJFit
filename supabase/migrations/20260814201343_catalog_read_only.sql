-- ---------------------------------------------------------------------------
-- Lock the shared exercise catalog to read-only for application users.
--
-- Phase 1 shipped categories, subcategories and exercises with a
-- `for all ... using (true) with check (true)` policy per table. That was a
-- deliberate call while AJFit was single-user: the catalog is shared reference
-- data with no per-row owner, so "any authenticated user may edit it" and "the
-- only authenticated user may edit it" were the same sentence.
--
-- They are not the same sentence any more. With real accounts on the project,
-- one person mistyping into a catalog row — or a compromised session — would
-- rewrite reference data for everybody, and nothing in the app writes to these
-- tables anyway. Catalog changes go through migrations from here on, which is
-- already how Push-Ups was added in 20260811202318.
--
-- Two layers are tightened, and both are load-bearing:
--
--   1. The RLS policy becomes SELECT-only. INSERT/UPDATE/DELETE lose their
--      policy entirely, and with RLS enabled the absence of a policy is a
--      denial, not a gap.
--   2. The table-level INSERT/UPDATE/DELETE grants are revoked. Phase 1 granted
--      `authenticated` full CRUD on every table because the platform's default
--      privileges give it none; leaving those grants in place while removing
--      the policies would still deny the write, but it would leave the
--      privilege layer contradicting the intent. Revoking makes the two layers
--      agree, and means a future policy added by accident cannot re-open a
--      write path on its own.
--
-- `service_role` is untouched: it bypasses RLS by design and is how the
-- Supabase dashboard and future catalog migrations edit this data. It is not
-- present in this codebase.
-- ---------------------------------------------------------------------------

-- Policies ------------------------------------------------------------------

drop policy if exists "Authenticated users manage the category catalog"
  on public.categories;
drop policy if exists "Authenticated users manage the subcategory catalog"
  on public.subcategories;
drop policy if exists "Authenticated users manage the exercise catalog"
  on public.exercises;

create policy "Authenticated users read the category catalog"
  on public.categories for select to authenticated
  using (true);

create policy "Authenticated users read the subcategory catalog"
  on public.subcategories for select to authenticated
  using (true);

create policy "Authenticated users read the exercise catalog"
  on public.exercises for select to authenticated
  using (true);

-- Grants --------------------------------------------------------------------

revoke insert, update, delete, truncate on
  public.categories,
  public.subcategories,
  public.exercises
from authenticated;

-- TRUNCATE is in that list because the platform's default privileges hand it to
-- `authenticated` on every new table, and unlike DELETE it is not filtered by
-- RLS — a truncate takes the whole table regardless of policy. PostgREST cannot
-- issue one (it only emits SELECT/INSERT/UPDATE/DELETE), so this is not a live
-- hole today; it is removed because a table declared read-only should not carry
-- a privilege that empties it, and the API surface is not the only thing that
-- ever holds this role.

-- `anon` was never granted anything on these tables and still isn't; the
-- catalog is not public reference data, it is signed-in reference data.
