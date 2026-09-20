create table if not exists public.client_app_health_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  reminder_week date not null,
  reminder_kind text not null check (reminder_kind in ('outdated_app', 'notifications_disabled', 'both')),
  email text not null default '',
  email_sent boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, reminder_week)
);

alter table public.client_app_health_reminders enable row level security;

drop policy if exists "Admins read client app health reminders" on public.client_app_health_reminders;
create policy "Admins read client app health reminders"
on public.client_app_health_reminders for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists client_app_health_reminders_sent_at_idx
  on public.client_app_health_reminders(sent_at desc);

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
      'client_app_health'
    )
  );

insert into public.site_settings (key, value)
values ('automation_settings', jsonb_build_object('client_app_health', true))
on conflict (key) do update
set value = coalesce(site_settings.value, '{}'::jsonb) || jsonb_build_object('client_app_health', true);

notify pgrst, 'reload schema';
