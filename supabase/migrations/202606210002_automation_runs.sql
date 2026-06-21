create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_key text not null check (automation_key in ('daily_payments', 'egg_reminders', 'google_reviews')),
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  trigger_source text not null default 'scheduled' check (trigger_source in ('scheduled', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.automation_runs enable row level security;

drop policy if exists "Admins read automation runs" on public.automation_runs;
create policy "Admins read automation runs"
on public.automation_runs for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists automation_runs_key_started_idx
  on public.automation_runs (automation_key, started_at desc);

notify pgrst, 'reload schema';
