create table if not exists public.admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  title text not null,
  target_type text,
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_logs_created_at_idx
  on public.admin_action_logs (created_at desc);

create index if not exists admin_action_logs_target_idx
  on public.admin_action_logs (target_type, target_id);

alter table public.admin_action_logs enable row level security;

drop policy if exists "Admins read admin action logs" on public.admin_action_logs;
create policy "Admins read admin action logs"
  on public.admin_action_logs
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

drop policy if exists "Admins insert admin action logs" on public.admin_action_logs;
create policy "Admins insert admin action logs"
  on public.admin_action_logs
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
