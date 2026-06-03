create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_push_subscriptions_user_id_idx
  on public.admin_push_subscriptions (user_id);

alter table public.admin_push_subscriptions enable row level security;

drop policy if exists "Admins manage own push subscriptions" on public.admin_push_subscriptions;

create policy "Admins manage own push subscriptions"
  on public.admin_push_subscriptions
  for all
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
