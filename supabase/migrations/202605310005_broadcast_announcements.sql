create table if not exists public.broadcast_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  send_push boolean not null default false,
  send_email boolean not null default false,
  push_sent integer not null default 0,
  push_total integer not null default 0,
  push_failed integer not null default 0,
  push_expired integer not null default 0,
  email_sent integer not null default 0,
  email_total integer not null default 0,
  email_failed integer not null default 0,
  status text not null default 'Envoyée',
  error_message text,
  result jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists broadcast_announcements_created_at_idx
  on public.broadcast_announcements (created_at desc);

alter table public.broadcast_announcements enable row level security;

drop policy if exists "Admins read broadcast announcements" on public.broadcast_announcements;
create policy "Admins read broadcast announcements"
  on public.broadcast_announcements
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

drop policy if exists "Admins insert broadcast announcements" on public.broadcast_announcements;
create policy "Admins insert broadcast announcements"
  on public.broadcast_announcements
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
