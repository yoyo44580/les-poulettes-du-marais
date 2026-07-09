create table if not exists public.kennel_contract_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.kennel_bookings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reminder_kind text not null check (reminder_kind in ('upcoming', 'urgent')),
  email_sent boolean not null default false,
  push_sent boolean not null default false,
  days_before integer not null,
  details jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (booking_id, reminder_kind)
);

alter table public.kennel_contract_reminders enable row level security;

drop policy if exists "Admins read kennel contract reminders" on public.kennel_contract_reminders;
create policy "Admins read kennel contract reminders"
on public.kennel_contract_reminders for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists kennel_contract_reminders_sent_at_idx
  on public.kennel_contract_reminders(sent_at desc);

alter table public.automation_runs
  drop constraint if exists automation_runs_automation_key_check;

alter table public.automation_runs
  add constraint automation_runs_automation_key_check
  check (automation_key in ('daily_payments', 'egg_reminders', 'google_reviews', 'kennel_contracts'));

notify pgrst, 'reload schema';
