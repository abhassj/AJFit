-- ---------------------------------------------------------------------------
-- Strip the privileges the platform hands out by default and nothing uses.
--
-- Found while auditing RLS ahead of real accounts. Supabase's default
-- privileges give both `anon` and `authenticated` Dxtm on every new table —
-- TRUNCATE, REFERENCES, TRIGGER, MAINTAIN. Phase 1's grant block added the CRUD
-- that PostgREST actually needs on top of that, but never addressed the
-- inherited four, so today `anon` holds TRUNCATE on profiles, sessions, sets
-- and everything else despite having no policy anywhere and no CRUD grant.
--
-- Why TRUNCATE specifically matters: it is not filtered by row level security.
-- Every other write verb is checked row by row against a policy, so `sessions`
-- being uid-scoped means a user can only delete their own. A TRUNCATE takes the
-- entire table for every user at once, policies notwithstanding. It is the one
-- default privilege that can undo the isolation the rest of this schema is
-- built on.
--
-- This is defence in depth, not an open hole being closed. PostgREST only ever
-- emits SELECT/INSERT/UPDATE/DELETE and RPC calls, so neither role can reach a
-- TRUNCATE through the API as things stand, and neither can escalate into one:
-- `anon` and `authenticated` have USAGE but not CREATE on public, auth and
-- storage, so the TRIGGER privilege cannot be paired with a function of their
-- own making. The point is that none of that should have to hold for the data
-- to be safe. A role keeps the privileges its job requires; `anon`'s job here
-- is to reach the auth endpoints and nothing else.
-- ---------------------------------------------------------------------------

-- `anon` gets nothing at all on application data. It has no policy on any of
-- these tables, so it could already read nothing; now it also holds nothing.
revoke all privileges on all tables in schema public from anon;

-- `authenticated` keeps the CRUD that Phase 1 granted and the SELECT-only
-- catalog access from 20260814201343. It loses only the RLS-bypassing verb.
revoke truncate on all tables in schema public from authenticated;
