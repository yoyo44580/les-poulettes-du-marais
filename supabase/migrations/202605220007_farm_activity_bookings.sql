create table if not exists public.educational_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  booking_date date not null,
  participants integer not null default 1,
  client_name text not null,
  client_email text not null,
  phone text,
  notes text,
  status text not null default 'Demandée',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  breed text,
  birth_year integer,
  sex text,
  vaccines_up_to_date boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kennel_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  start_date date not null,
  end_date date not null,
  client_name text not null,
  client_email text not null,
  phone text,
  notes text,
  status text not null default 'Demandée',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.educational_bookings enable row level security;
alter table public.dogs enable row level security;
alter table public.kennel_bookings enable row level security;

drop policy if exists "Clients manage own educational bookings" on public.educational_bookings;
create policy "Clients manage own educational bookings"
on public.educational_bookings
for all
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Clients manage own dogs" on public.dogs;
create policy "Clients manage own dogs"
on public.dogs
for all
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Clients manage own kennel bookings" on public.kennel_bookings;
create policy "Clients manage own kennel bookings"
on public.kennel_bookings
for all
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);
