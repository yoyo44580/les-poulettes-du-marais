alter table public.profiles
  add column if not exists delivery_address text;
