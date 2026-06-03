create table if not exists public.client_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_push_subscriptions_user_id_idx
  on public.client_push_subscriptions (user_id);

alter table public.client_push_subscriptions enable row level security;

drop policy if exists "Clients manage own push subscriptions" on public.client_push_subscriptions;
create policy "Clients manage own push subscriptions"
on public.client_push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
