alter table public.admin_action_logs
  add column if not exists seen_at timestamptz;

create index if not exists admin_action_logs_seen_at_idx
  on public.admin_action_logs (seen_at, created_at desc);

drop policy if exists "Admins update admin action logs" on public.admin_action_logs;
create policy "Admins update admin action logs"
  on public.admin_action_logs
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
