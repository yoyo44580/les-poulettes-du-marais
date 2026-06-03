alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists comment text;
