create table if not exists public.client_app_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_version text not null default '',
  build_commit text,
  build_time timestamptz,
  release_key text not null default '',
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_app_versions enable row level security;

drop policy if exists "Users insert own app version" on public.client_app_versions;
create policy "Users insert own app version"
on public.client_app_versions for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own app version" on public.client_app_versions;
create policy "Users update own app version"
on public.client_app_versions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users read own app version" on public.client_app_versions;
create policy "Users read own app version"
on public.client_app_versions for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins read client app versions" on public.client_app_versions;
create policy "Admins read client app versions"
on public.client_app_versions for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists client_app_versions_last_seen_idx
  on public.client_app_versions(last_seen_at desc);

create or replace function public.set_client_app_version_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_client_app_version_updated_at_trigger on public.client_app_versions;
create trigger set_client_app_version_updated_at_trigger
before update on public.client_app_versions
for each row execute function public.set_client_app_version_updated_at();

notify pgrst, 'reload schema';
