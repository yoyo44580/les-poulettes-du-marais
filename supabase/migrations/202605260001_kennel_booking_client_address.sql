alter table public.kennel_bookings
  add column if not exists client_address text;
