create table if not exists public.client_account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  full_name text,
  phone text,
  delivery_address text,
  deletion_source text not null default 'client_space',
  user_agent text,
  deleted_at timestamptz not null default now()
);

create index if not exists client_account_deletions_deleted_at_idx
on public.client_account_deletions (deleted_at desc);

alter table public.client_account_deletions enable row level security;

drop policy if exists "Admins can read deleted client accounts" on public.client_account_deletions;
create policy "Admins can read deleted client accounts"
on public.client_account_deletions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
