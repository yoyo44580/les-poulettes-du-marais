insert into public.site_settings (key, value)
values (
  'occasional_sales',
  '{
    "enabled": false,
    "eyebrow": "Vente ponctuelle",
    "title": "Réservations du moment",
    "text": "Retrouvez ici les ventes disponibles en quantité limitée à la ferme.",
    "notice_text": "Pensez a prevoir un carton ou une caisse adaptee pour le transport.",
    "image_url": "/images/marais.jpg",
    "items": [
      {
        "id": "reform-hens",
        "name": "Poules de réforme",
        "description": "Poules pondeuses proposées ponctuellement pour leur offrir une nouvelle maison.",
        "price": "",
        "unit_label": "poule",
        "available_quantity": "",
        "image_url": "",
        "active": true
      },
      {
        "id": "apple-juice",
        "name": "Jus de pomme local",
        "description": "Jus de pomme fabriqué par une association locale, disponible selon les arrivages.",
        "price": "",
        "unit_label": "bouteille",
        "available_quantity": "",
        "image_url": "",
        "active": true
      }
    ]
  }'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.occasional_sale_reservations (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  client_name text not null,
  client_email text,
  phone text,
  notes text,
  status text not null default 'Nouvelle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists occasional_sale_reservations_created_at_idx
  on public.occasional_sale_reservations (created_at desc);

create index if not exists occasional_sale_reservations_status_idx
  on public.occasional_sale_reservations (status);

alter table public.occasional_sale_reservations enable row level security;

drop policy if exists "Anyone can create occasional sale reservations" on public.occasional_sale_reservations;
create policy "Anyone can create occasional sale reservations"
on public.occasional_sale_reservations
for insert
to anon, authenticated
with check (
  client_name is not null
  and item_id is not null
  and item_name is not null
  and quantity > 0
);

drop policy if exists "Admins manage occasional sale reservations" on public.occasional_sale_reservations;
create policy "Admins manage occasional sale reservations"
on public.occasional_sale_reservations
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
