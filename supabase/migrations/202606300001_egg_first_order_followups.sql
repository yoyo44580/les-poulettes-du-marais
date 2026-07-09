create table if not exists public.egg_first_order_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.egg_first_order_followups enable row level security;

drop policy if exists "Admins read first egg order followups" on public.egg_first_order_followups;
create policy "Admins read first egg order followups"
on public.egg_first_order_followups for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

create index if not exists egg_first_order_followups_sent_at_idx
  on public.egg_first_order_followups(sent_at desc);

notify pgrst, 'reload schema';
