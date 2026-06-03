alter table if exists public.orders
  add column if not exists archived_at timestamptz;

alter table if exists public.educational_bookings
  add column if not exists archived_at timestamptz;

alter table if exists public.kennel_bookings
  add column if not exists archived_at timestamptz;

create index if not exists orders_archived_at_idx
  on public.orders (archived_at);

create index if not exists educational_bookings_archived_at_idx
  on public.educational_bookings (archived_at);

create index if not exists kennel_bookings_archived_at_idx
  on public.kennel_bookings (archived_at);
