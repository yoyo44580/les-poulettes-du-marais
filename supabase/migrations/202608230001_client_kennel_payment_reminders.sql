create table if not exists public.kennel_payment_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.kennel_bookings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reminder_date date not null default current_date,
  email_sent boolean not null default false,
  push_sent boolean not null default false,
  remaining_amount numeric(10, 2) not null default 0,
  sent_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (booking_id, reminder_date)
);

alter table public.kennel_payment_reminders enable row level security;

drop policy if exists "Admins read kennel payment reminders" on public.kennel_payment_reminders;
create policy "Admins read kennel payment reminders"
on public.kennel_payment_reminders for select to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin is true
  )
);

create index if not exists kennel_payment_reminders_booking_id_idx
  on public.kennel_payment_reminders(booking_id);

create index if not exists kennel_payment_reminders_sent_at_idx
  on public.kennel_payment_reminders(sent_at desc);

alter table public.automation_runs
  drop constraint if exists automation_runs_automation_key_check;

alter table public.automation_runs
  add constraint automation_runs_automation_key_check
  check (
    automation_key in (
      'daily_payments',
      'egg_reminders',
      'google_reviews',
      'kennel_contracts',
      'client_messages',
      'client_app_health',
      'admin_urgent_followups',
      'client_kennel_payments'
    )
  );

insert into public.site_settings (key, value)
values ('automation_settings', '{"client_kennel_payments": true}'::jsonb)
on conflict (key) do update
set value = coalesce(public.site_settings.value, '{}'::jsonb) || '{"client_kennel_payments": true}'::jsonb;

notify pgrst, 'reload schema';
