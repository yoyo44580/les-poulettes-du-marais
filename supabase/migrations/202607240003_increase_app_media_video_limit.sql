update storage.buckets
set
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
where id = 'app-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'app-media',
  'app-media',
  true,
  104857600,
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
where not exists (
  select 1
  from storage.buckets
  where id = 'app-media'
);
