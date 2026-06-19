create table if not exists public.egg_order_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  lead_hours integer not null check (lead_hours in (24, 48)),
  usual_weekday integer not null check (usual_weekday between 0 and 6),
  email_sent boolean not null default false,
  push_sent boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, target_date, lead_hours)
);

alter table public.egg_order_reminders enable row level security;

drop policy if exists "Admins read egg order reminders" on public.egg_order_reminders;
create policy "Admins read egg order reminders"
on public.egg_order_reminders for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists egg_order_reminders_target_date_idx
  on public.egg_order_reminders(target_date desc);
