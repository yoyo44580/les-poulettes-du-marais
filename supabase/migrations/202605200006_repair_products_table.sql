create table if not exists public.products (
  id text primary key
);

alter table public.products add column if not exists name text;
alter table public.products add column if not exists price numeric(10, 2);
alter table public.products add column if not exists unit_label text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists size_eggs integer;
alter table public.products add column if not exists active boolean;
alter table public.products add column if not exists sort_order integer;
alter table public.products add column if not exists created_at timestamptz;
alter table public.products add column if not exists updated_at timestamptz;

alter table public.products alter column name set default '';
alter table public.products alter column price set default 0;
alter table public.products alter column unit_label set default 'piece';
alter table public.products alter column size_eggs set default 0;
alter table public.products alter column active set default true;
alter table public.products alter column sort_order set default 100;
alter table public.products alter column created_at set default now();
alter table public.products alter column updated_at set default now();

update public.products set name = coalesce(name, id);
update public.products set price = coalesce(price, 0);
update public.products set unit_label = coalesce(unit_label, 'piece');
update public.products set size_eggs = coalesce(size_eggs, 0);
update public.products set active = coalesce(active, true);
update public.products set sort_order = coalesce(sort_order, 100);
update public.products set created_at = coalesce(created_at, now());
update public.products set updated_at = coalesce(updated_at, now());

alter table public.products alter column name set not null;
alter table public.products alter column price set not null;
alter table public.products alter column unit_label set not null;
alter table public.products alter column size_eggs set not null;
alter table public.products alter column active set not null;
alter table public.products alter column sort_order set not null;
alter table public.products alter column created_at set not null;
alter table public.products alter column updated_at set not null;

alter table public.orders add column if not exists items jsonb;

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
  price = excluded.price,
  unit_label = excluded.unit_label,
  image_url = excluded.image_url,
  size_eggs = excluded.size_eggs,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.products enable row level security;

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
