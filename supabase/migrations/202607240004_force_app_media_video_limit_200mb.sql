insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-media',
  'app-media',
  true,
  209715200,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

select
  id,
  name,
  public,
  file_size_limit,
  round(file_size_limit / 1024.0 / 1024.0, 2) as file_size_limit_mb,
  allowed_mime_types
from storage.buckets
where id = 'app-media';
