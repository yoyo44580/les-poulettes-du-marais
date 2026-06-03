alter table public.educational_bookings
  add column if not exists deposit_amount numeric(10, 2) default 0,
  add column if not exists payment_received boolean default false,
  add column if not exists payment_method text default 'Non renseigné',
  add column if not exists payment_received_at timestamptz;

alter table public.kennel_bookings
  add column if not exists deposit_amount numeric(10, 2) default 0,
  add column if not exists payment_received boolean default false,
  add column if not exists payment_method text default 'Non renseigné',
  add column if not exists payment_received_at timestamptz;
