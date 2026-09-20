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

create table if not exists public.farm_animal_documents (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.farm_animals(id) on delete cascade,
  title text not null,
  document_type text not null default 'other',
  document_date date not null default current_date,
  notes text not null default '',
  file_url text not null,
  file_path text not null default '',
  file_name text not null default '',
  mime_type text not null default '',
  file_size bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farm_animal_documents_animal_id_idx
  on public.farm_animal_documents (animal_id);

create index if not exists farm_animal_documents_document_date_idx
  on public.farm_animal_documents (document_date desc);

alter table public.farm_animal_documents enable row level security;

drop policy if exists "Admins read farm animal documents" on public.farm_animal_documents;
create policy "Admins read farm animal documents"
  on public.farm_animal_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins insert farm animal documents" on public.farm_animal_documents;
create policy "Admins insert farm animal documents"
  on public.farm_animal_documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins update farm animal documents" on public.farm_animal_documents;
create policy "Admins update farm animal documents"
  on public.farm_animal_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop policy if exists "Admins delete farm animal documents" on public.farm_animal_documents;
create policy "Admins delete farm animal documents"
  on public.farm_animal_documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

drop trigger if exists farm_animal_documents_updated_at_trigger on public.farm_animal_documents;
create trigger farm_animal_documents_updated_at_trigger
before update on public.farm_animal_documents
for each row execute function public.set_farm_animals_updated_at();

notify pgrst, 'reload schema';
