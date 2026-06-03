create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric(10, 2) not null default 0,
  unit_label text not null default 'piece',
  image_url text,
  size_eggs integer not null default 0,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists price numeric(10, 2) not null default 0,
  add column if not exists unit_label text not null default 'piece',
  add column if not exists image_url text,
  add column if not exists size_eggs integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists sort_order integer not null default 100,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.orders
  add column if not exists items jsonb;

insert into public.products (
  id,
  name,
  price,
  unit_label,
  image_url,
  size_eggs,
  active,
  sort_order
)
values
  ('box6', 'Boite de 6 oeufs', 2.40, 'boite', '/images/oeufs-6.jpg', 6, true, 10),
  ('box12', 'Boite de 12 oeufs', 4.80, 'boite', '/images/oeufs-12.jpg', 12, true, 20)
on conflict (id) do update set
  name = excluded.name,
  unit_label = excluded.unit_label,
  image_url = excluded.image_url,
  size_eggs = excluded.size_eggs,
  active = excluded.active,
  sort_order = excluded.sort_order;

alter table public.products enable row level security;

drop policy if exists "Products are readable" on public.products;
create policy "Products are readable"
on public.products
for select
using (true);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
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

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
