insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-media',
  'app-media',
  true,
  83886080,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read app media" on storage.objects;
create policy "Public read app media"
on storage.objects for select
using (bucket_id = 'app-media');

drop policy if exists "Admins upload app media" on storage.objects;
create policy "Admins upload app media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'app-media'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

drop policy if exists "Admins update app media" on storage.objects;
create policy "Admins update app media"
on storage.objects for update to authenticated
using (
  bucket_id = 'app-media'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
)
with check (
  bucket_id = 'app-media'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

drop policy if exists "Admins delete app media" on storage.objects;
create policy "Admins delete app media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'app-media'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

insert into public.site_settings (key, value)
values (
  'home_video',
  jsonb_build_object(
    'enabled', false,
    'eyebrow', 'En images',
    'title', 'La vie aux Poulettes du Marais',
    'text', 'Decouvrez un evenement, la pension canine ou un moment de vie a la ferme.',
    'video_url', '',
    'poster_url', '/images/pension-canine-1.jpg',
    'autoplay', false
  )
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
