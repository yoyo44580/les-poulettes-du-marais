alter table public.poultry_expenses
  add column if not exists document_url text not null default '',
  add column if not exists document_path text not null default '',
  add column if not exists document_name text not null default '',
  add column if not exists document_mime_type text not null default '',
  add column if not exists document_size bigint not null default 0;

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
    'video/x-matroska',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
