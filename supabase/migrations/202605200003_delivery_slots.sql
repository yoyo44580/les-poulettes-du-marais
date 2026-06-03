create table if not exists public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  delivery_date date not null unique,
  label text not null default '',
  max_orders integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists delivery_slots_delivery_date_idx
  on public.delivery_slots (delivery_date);
