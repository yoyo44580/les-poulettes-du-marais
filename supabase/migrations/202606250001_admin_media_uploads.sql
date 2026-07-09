insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-media',
  'app-media',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read app media" on storage.objects;
create policy "Public read app media"
on storage.objects
for select
using (bucket_id = 'app-media');

drop policy if exists "Admins upload app media" on storage.objects;
create policy "Admins upload app media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'app-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins update app media" on storage.objects;
create policy "Admins update app media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'app-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  bucket_id = 'app-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins delete app media" on storage.objects;
create policy "Admins delete app media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'app-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
