create table if not exists public.kennel_services (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  unit_label text not null default 'jour',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.kennel_services (
  id,
  name,
  description,
  price,
  unit_label,
  active,
  sort_order
)
values
  (
    'day-care',
    'Journée pension',
    'Accueil à la journée avec suivi manuel des disponibilités.',
    0,
    'jour',
    true,
    10
  ),
  (
    'overnight',
    'Journée pension',
    'Séjour facturé à la journée, fiche chien et habitudes à préciser.',
    0,
    'jour',
    true,
    20
  ),
  (
    'long-stay',
    'Séjour longue durée',
    'Demande personnalisée pour les vacances ou absences prolongées.',
    0,
    'séjour',
    true,
    30
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  unit_label = excluded.unit_label,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.kennel_services enable row level security;

drop policy if exists "Kennel services are readable" on public.kennel_services;
create policy "Kennel services are readable"
on public.kennel_services
for select
using (true);

drop policy if exists "Admins can insert kennel services" on public.kennel_services;
create policy "Admins can insert kennel services"
on public.kennel_services
for insert
to authenticated
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can update kennel services" on public.kennel_services;
create policy "Admins can update kennel services"
on public.kennel_services
for update
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

drop policy if exists "Admins can delete kennel services" on public.kennel_services;
create policy "Admins can delete kennel services"
on public.kennel_services
for delete
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);
