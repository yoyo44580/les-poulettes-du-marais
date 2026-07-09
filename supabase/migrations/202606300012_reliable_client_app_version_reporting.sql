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

create or replace function public.report_client_app_version(
  p_app_version text,
  p_build_commit text,
  p_build_time timestamptz,
  p_release_key text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.client_app_versions (
    user_id,
    app_version,
    build_commit,
    build_time,
    release_key,
    user_agent,
    last_seen_at
  )
  values (
    v_user_id,
    coalesce(p_app_version, ''),
    nullif(p_build_commit, ''),
    p_build_time,
    coalesce(p_release_key, ''),
    coalesce(p_user_agent, ''),
    now()
  )
  on conflict (user_id) do update set
    app_version = excluded.app_version,
    build_commit = excluded.build_commit,
    build_time = excluded.build_time,
    release_key = excluded.release_key,
    user_agent = excluded.user_agent,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.report_client_app_version(text, text, timestamptz, text, text) from public;
grant execute on function public.report_client_app_version(text, text, timestamptz, text, text) to authenticated;

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

notify pgrst, 'reload schema';
