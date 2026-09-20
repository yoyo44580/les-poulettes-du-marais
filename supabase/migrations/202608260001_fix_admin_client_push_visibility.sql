alter table public.client_push_subscriptions
  add column if not exists user_agent text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists client_push_subscriptions_user_id_idx
  on public.client_push_subscriptions(user_id);

create index if not exists client_push_subscriptions_updated_at_idx
  on public.client_push_subscriptions(updated_at desc);

alter table public.client_push_subscriptions enable row level security;

drop policy if exists "Admins read client push subscriptions" on public.client_push_subscriptions;
create policy "Admins read client push subscriptions"
on public.client_push_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin is true
  )
);

drop policy if exists "Clients manage own push subscriptions" on public.client_push_subscriptions;
create policy "Clients manage own push subscriptions"
on public.client_push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_client_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_push_subscription_updated_at_trigger
on public.client_push_subscriptions;

create trigger set_client_push_subscription_updated_at_trigger
before update on public.client_push_subscriptions
for each row
execute function public.set_client_push_subscription_updated_at();

notify pgrst, 'reload schema';
