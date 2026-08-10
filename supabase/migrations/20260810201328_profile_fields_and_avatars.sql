-- AJFit — profile identity fields and avatar storage.
--
-- Adds the columns the Profile page writes to, and an `avatars` bucket where a
-- user may only ever write inside a folder named after their own uid.

alter table public.profiles
  add column display_name text,
  add column avatar_url text,
  add column bio text;

-- ---------------------------------------------------------------------------
-- Avatar storage
--
-- The bucket is public-read. Avatars are rendered by <img src> all over the
-- app, and a private bucket would mean minting a signed URL for every render.
-- Public read is the standard trade for avatar images; nothing sensitive is
-- stored here, and write access is still restricted per user below.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored as "<uid>/<filename>", so the first path segment is the
-- owner. storage.foldername() splits the object name into its path segments.

drop policy if exists "Avatar images are readable" on storage.objects;
create policy "Avatar images are readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
