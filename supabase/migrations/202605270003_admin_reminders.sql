create table if not exists public.admin_reminders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  due_date date not null,
  priority text not null default 'Normal',
  status text not null default 'À faire',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_reminders enable row level security;

drop policy if exists "Admins manage reminders" on public.admin_reminders;
create policy "Admins manage reminders"
on public.admin_reminders
for all
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

create index if not exists admin_reminders_due_date_idx
  on public.admin_reminders(due_date);

create index if not exists admin_reminders_profile_id_idx
  on public.admin_reminders(profile_id);
