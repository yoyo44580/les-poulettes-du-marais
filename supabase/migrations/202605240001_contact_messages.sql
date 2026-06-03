create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status text not null default 'Nouveau',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can create contact messages" on public.contact_messages;
create policy "Anyone can create contact messages"
on public.contact_messages
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins manage contact messages" on public.contact_messages;
create policy "Admins manage contact messages"
on public.contact_messages
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
